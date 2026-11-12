import importlib.util, json, tempfile, unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path
from uuid import UUID
spec=importlib.util.spec_from_file_location("trainer",Path(__file__).with_name("train-tic-real.py"))
trainer=importlib.util.module_from_spec(spec);spec.loader.exec_module(trainer)
def row(project=1,task=1,day=1,done=True):
    observed=datetime(2026,1,day,tzinfo=timezone.utc)
    deadline=observed+timedelta(hours=48); completed=observed+timedelta(hours=12) if done else None
    return {"source":"real","consented":True,"workspace_group":str(UUID(int=project)),"task_group":str(UUID(int=task)),
            "observed_at":observed.isoformat(),"deadline_at":deadline.isoformat(),"completed_at":completed.isoformat() if completed else None,
            "outcome_observed_at":(completed or deadline).isoformat(),"deadline_changed":False,
            "features":dict(zip(trainer.FEATURES,[1,0,24,2,48,.2,8,1,1,.5,12,0]))}
class Contract(unittest.TestCase):
    def test_labels_and_exact_features(self):
        self.assertEqual(trainer.validate(row())["y"],0)
        self.assertEqual(trainer.validate(row(done=False))["y"],1)
        self.assertEqual(len(trainer.validate(row())["x"]),12)
    def test_rejects_synthetic_unconsented_private_and_future_labels(self):
        for r in [{**row(),"source":"synthetic"},{**row(),"consented":False},{**row(),"deadline_changed":True},{**row(),"name":"private"},{**row(done=False),"outcome_observed_at":"2026-01-01T01:00:00Z"}]:
            with self.assertRaises(ValueError): trainer.validate(r)
        r=row();r["features"]["review_hours"]=float("nan")
        with self.assertRaises(ValueError):trainer.validate(r)
    def test_no_group_or_chronology_leakage(self):
        rows=[trainer.validate(r) for r in [row(1,1,1),row(2,2,10),row(3,3,20),row(4,4,1),row(4,5,20)]]
        splits,omitted=trainer.partition(rows,trainer.timestamp("2026-01-08T00:00:00Z"),trainer.timestamp("2026-01-18T00:00:00Z"))
        self.assertEqual([len(x) for x in splits],[1,1,1]);self.assertEqual(omitted,2)
        with self.assertRaises(ValueError):trainer.check_partitions(splits)
    def test_duplicate_exports_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"fixture.json";p.write_text(json.dumps({"schema_version":"tic-real-v1","rows":[row(),row()]}))
            with self.assertRaises(ValueError):trainer.load([p])
    def test_promotion_gate_is_not_automatic(self):
        self.assertTrue(trainer.release_gate({"average_precision":.8,"brier":.1,"precision":.8,"recall":.8},{"average_precision":.5,"brier":.25}))
        self.assertFalse(trainer.release_gate({"average_precision":.8,"brier":.1,"precision":.8,"recall":.2},{"average_precision":.5,"brier":.25}))
if __name__=="__main__":unittest.main()
