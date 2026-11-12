"""Train a review-only TIC candidate from explicit owner-authorized exports.

Never upload exports to GitHub, infer individual performance or activate a model.
Use chronological, project-disjoint partitions and no raw records in artifacts.
"""
import argparse
import hashlib
import json
import math
from datetime import datetime
from pathlib import Path
from uuid import UUID

FEATURES = ("ci_failures","blocked","review_hours","downstream_count","deadline_hours","capacity_gap",
            "estimate_hours","dependency_depth","unfinished_predecessors","workload_ratio","task_age_hours","ci_retries")
INTEGER = {"ci_failures","blocked","downstream_count","dependency_depth","unfinished_predecessors","ci_retries"}
FIELDS = {"source","consented","workspace_group","task_group","observed_at","deadline_at","completed_at",
          "outcome_observed_at","deadline_changed","features"}
POLICY = {"min_groups":[6,3,3],"min_rows":[200,100,100],"min_class":20,
          "min_test_ap_gain":0.02,"min_precision":0.60,"min_recall":0.70}

def timestamp(value):
    if not isinstance(value,str): raise ValueError("Timestamp required")
    result=datetime.fromisoformat(value.replace("Z","+00:00"))
    if result.utcoffset() is None: raise ValueError("Timezone required")
    return result

def group(value):
    if not isinstance(value,str): raise ValueError("Pseudonymous UUID required")
    return str(UUID(value))

def validate(row):
    if not isinstance(row,dict) or set(row)!=FIELDS: raise ValueError("Unexpected learning fields")
    if row["source"]!="real" or row["consented"] is not True or row["deadline_changed"] is not False:
        raise ValueError("Only consented, non-revised real observations are eligible")
    w,t=group(row["workspace_group"]),group(row["task_group"])
    observed,deadline,outcome=map(timestamp,[row["observed_at"],row["deadline_at"],row["outcome_observed_at"]])
    completed=timestamp(row["completed_at"]) if row["completed_at"] is not None else None
    if not observed<deadline or outcome<observed or (completed is not None and not observed<=completed<=outcome) or (completed is None and outcome<deadline):
        raise ValueError("Incomplete or non-prospective outcome")
    f=row["features"]
    if not isinstance(f,dict) or set(f)!=set(FEATURES): raise ValueError("Invalid feature contract")
    for k,v in f.items():
        if type(v) not in (int,float) or not math.isfinite(v) or v<0 or (k in INTEGER and v!=int(v)):
            raise ValueError("Invalid numeric feature")
    if f["blocked"] not in (0,1) or f["capacity_gap"]>1 or f["estimate_hours"]<=0 or f["deadline_hours"]<=0:
        raise ValueError("Invalid bounded feature")
    if abs(f["deadline_hours"]-(deadline-observed).total_seconds()/3600)>0.01:
        raise ValueError("Deadline feature does not match snapshot")
    return {"workspace":w,"task":t,"observed":observed,"outcome":outcome,
            "x":[float(f[k]) for k in FEATURES],"y":int(completed is None or completed>deadline)}

def load(paths):
    rows=[]; seen=set()
    for path in paths:
        document=json.loads(Path(path).read_text(encoding="utf-8"))
        if not isinstance(document,dict) or set(document)!={"schema_version","rows"} or document["schema_version"]!="tic-real-v1" or not isinstance(document["rows"],list):
            raise ValueError("Expected TIC learning export")
        for raw in document["rows"]:
            item=validate(raw); key=(item["workspace"],item["task"])
            if key in seen: raise ValueError("Duplicate task; use one latest export per workspace")
            seen.add(key); rows.append(item)
    return rows

def partition(rows,validation_start,test_start):
    if not validation_start<test_start: raise ValueError("Invalid chronological cutoffs")
    groups={}
    for row in rows: groups.setdefault(row["workspace"],[]).append(row)
    splits=[[],[],[]]; omitted=0
    for items in groups.values():
        first=min(r["observed"] for r in items); last=max(r["outcome"] for r in items)
        if last<validation_start: splits[0].extend(items)
        elif first>=validation_start and last<test_start: splits[1].extend(items)
        elif first>=test_start: splits[2].extend(items)
        else: omitted+=len(items)
    return splits,omitted

def check_partitions(splits):
    for i,rows in enumerate(splits):
        groups=len({r["workspace"] for r in rows}); positives=sum(r["y"] for r in rows)
        if groups<POLICY["min_groups"][i] or len(rows)<POLICY["min_rows"][i] or min(positives,len(rows)-positives)<POLICY["min_class"]:
            raise ValueError("Insufficient project-disjoint chronological data or class diversity in split "+str(i+1))

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(",",":"),allow_nan=False).encode("utf-8")

def release_gate(metrics,baseline):
    return (metrics["average_precision"]>=baseline["average_precision"]+POLICY["min_test_ap_gain"]
            and metrics["brier"]<baseline["brier"] and metrics["precision"]>=POLICY["min_precision"]
            and metrics["recall"]>=POLICY["min_recall"])

def train(splits,omitted):
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    from sklearn.metrics import average_precision_score,brier_score_loss,precision_score,recall_score,f1_score
    from xgboost import XGBClassifier
    check_partitions(splits)
    X=[np.asarray([r["x"] for r in rows],dtype=float) for rows in splits]
    y=[np.asarray([r["y"] for r in rows],dtype=int) for rows in splits]
    models={"logistic":make_pipeline(StandardScaler(),LogisticRegression(max_iter=1000)),
            "random_forest":RandomForestClassifier(n_estimators=150,max_depth=7,min_samples_leaf=10,random_state=42,n_jobs=2),
            "xgboost":XGBClassifier(n_estimators=150,max_depth=3,learning_rate=.05,subsample=.8,colsample_bytree=.9,random_state=42,n_jobs=2,eval_metric="logloss")}
    selection={}
    for name,model in models.items():
        model.fit(X[0],y[0]); p=model.predict_proba(X[1])[:,1]
        selection[name]=float(average_precision_score(y[1],p))
    chosen=max(selection,key=lambda n:(selection[n],n=="logistic")); model=models[chosen]
    val=model.predict_proba(X[1])[:,1]
    thresholds=[i/100 for i in range(1,100)]
    feasible=[t for t in thresholds if precision_score(y[1],val>=t,zero_division=0)>=POLICY["min_precision"]]
    threshold=max(feasible or thresholds,key=lambda t:(f1_score(y[1],val>=t,zero_division=0),t))
    # Test is read once after model and threshold selection.
    prob=model.predict_proba(X[2])[:,1]; pred=prob>=threshold
    metrics={"average_precision":float(average_precision_score(y[2],prob)),
             "brier":float(brier_score_loss(y[2],prob)),
             "precision":float(precision_score(y[2],pred,zero_division=0)),
             "recall":float(recall_score(y[2],pred,zero_division=0)),
             "f1":float(f1_score(y[2],pred,zero_division=0))}
    baseline={"average_precision":float(y[2].mean()),"brier":float(brier_score_loss(y[2],np.full(len(y[2]),y[0].mean())))}
    if chosen=="logistic":
        scale,lr=model.steps[0][1],model.steps[1][1]
        weights={"mean":scale.mean_.tolist(),"scale":scale.scale_.tolist(),"coefficients":lr.coef_[0].tolist(),"bias":float(lr.intercept_[0])}
    elif chosen=="random_forest":
        weights={"trees":[{"left":e.tree_.children_left.tolist(),"right":e.tree_.children_right.tolist(),
                           "feature":e.tree_.feature.tolist(),"threshold":e.tree_.threshold.tolist(),
                           "positive_probability":(e.tree_.value[:,0,1]/e.tree_.value[:,0,:].sum(axis=1)).tolist()} for e in model.estimators_]}
    else:
        weights={"booster":json.loads(bytes(model.get_booster().save_raw(raw_format="json")))}
    artifact={"schema_version":"tic-real-candidate-v1","status":"candidate_not_activated","algorithm":chosen,
              "features":list(FEATURES),"weights":weights,"threshold":threshold,"validation_ap":selection,
              "test_metrics":metrics,"baseline":baseline,"policy":POLICY,"eligible_for_review":bool(feasible) and release_gate(metrics,baseline),
              "automatic_promotion":False,"split_counts":[{"projects":len({r["workspace"] for r in rows}),"rows":len(rows)} for rows in splits],
              "omitted_cross_boundary_rows":omitted,"training_min":X[0].min(axis=0).tolist(),"training_max":X[0].max(axis=0).tolist(),
              "promotion_requirements":["Independent serving parity test","Owner-approved model review","Exact integrated CI","Production release approval"]}
    artifact["artifact_sha256"]=hashlib.sha256(canonical(artifact)).hexdigest()
    return artifact

def main():
    p=argparse.ArgumentParser();p.add_argument("--input",nargs="+",required=True);p.add_argument("--validation-start",required=True);p.add_argument("--test-start",required=True);p.add_argument("--output",required=True)
    a=p.parse_args()
    rows=load(a.input);splits,omitted=partition(rows,timestamp(a.validation_start),timestamp(a.test_start))
    result=train(splits,omitted)
    path=Path(a.output)
    if path.exists(): raise ValueError("Choose a new immutable candidate artifact filename")
    with path.open("x",encoding="utf-8") as f: json.dump(result,f,indent=2,allow_nan=False);f.write("\n")
    print(json.dumps({k:result[k] for k in ("algorithm","status","eligible_for_review","artifact_sha256","test_metrics","split_counts")},indent=2))

if __name__=="__main__":
    try: main()
    except (ValueError,OSError) as error: raise SystemExit("Candidate refused: "+str(error))
