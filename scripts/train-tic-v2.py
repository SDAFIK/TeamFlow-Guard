import json, numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import average_precision_score,brier_score_loss,precision_score,recall_score,f1_score
from xgboost import XGBClassifier

def run():
 r=np.random.default_rng(42); n=12000; g=np.repeat(np.arange(120),100)
 ci=r.poisson(1.1,n); blocked=r.binomial(1,.2,n); review=r.exponential(24,n); downstream=r.integers(0,9,n); deadline=r.uniform(4,120,n); gap=r.beta(2,5,n); effort=r.uniform(1,40,n); depth=r.integers(0,6,n); predecessors=r.integers(0,5,n); load=r.uniform(0,2,n); age=r.exponential(48,n); retries=r.poisson(.7,n)
 X=np.column_stack([ci,blocked,review,downstream,deadline,gap,effort,depth,predecessors,load,age,retries]); z=-2+.35*ci+.9*blocked+.012*review+.08*downstream-.012*deadline+1.1*gap+.025*effort+.12*depth+.12*predecessors+.45*load+.004*age+.1*retries+.9*((ci>=2)&(blocked==1))+.7*((gap>.5)&(deadline<24))+r.normal(0,.55,120)[g]; y=r.binomial(1,1/(1+np.exp(-z)))
 tr=g<72; va=(g>=72)&(g<96); te=g>=96
 models={'logistic':make_pipeline(StandardScaler(),LogisticRegression(max_iter=1000)), 'random_forest':RandomForestClassifier(n_estimators=150,max_depth=7,min_samples_leaf=20,random_state=42,n_jobs=2),'xgboost':XGBClassifier(n_estimators=150,max_depth=3,learning_rate=.05,subsample=.8,colsample_bytree=.9,random_state=42,n_jobs=2,eval_metric='logloss')}
 out={}
 for name,m in models.items():
  m.fit(X[tr],y[tr]); v=m.predict_proba(X[va])[:,1]; p=m.predict_proba(X[te])[:,1]; threshold=max(np.arange(.1,.91,.01),key=lambda t:f1_score(y[va],v>=t)); pred=p>=threshold
  out[name]={'validation_ap':round(float(average_precision_score(y[va],v)),4),'test_ap':round(float(average_precision_score(y[te],p)),4),'brier':round(float(brier_score_loss(y[te],p)),4),'threshold':round(float(threshold),2),'precision':round(float(precision_score(y[te],pred)),4),'recall':round(float(recall_score(y[te],pred)),4),'f1':round(float(f1_score(y[te],pred)),4)}
 return {'status':'synthetic_only','seed':42,'projects':[72,24,24],'rows':[7200,2400,2400],'features':['ci_failures','blocked','review_hours','downstream_count','deadline_hours','capacity_gap','estimate_hours','dependency_depth','unfinished_predecessors','workload_ratio','task_age_hours','ci_retries'],'candidate_selected_by_validation_ap':max(out,key=lambda k:out[k]['validation_ap']),'metrics':out,'baseline_test_ap':round(float(y[te].mean()),4),'baseline_brier':round(float(brier_score_loss(y[te],np.full(te.sum(),y[tr].mean()))),4)}
if __name__=='__main__': print(json.dumps(run(),indent=2))
