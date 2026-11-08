# Local demonstration

1. Open http://localhost:3000 and sign in with the lead account listed in README and the password in the ignored `.local/DEMO_LOGIN.txt`.
2. Show the computed overview and the Demo workspace label. Open the dependency map and select Login UI; four unfinished successors are exposed, while Catalog stays independent.
3. Replay a CI failure for Login UI. Explain that this is a fictional sample, then inspect its source record and derived impact.
4. Choose **Use rule-based recovery**, or **Analyze with OpenAI** only after configuring and verifying the real provider. Review the source label, assumptions and before/after values.
5. Approve a feasible current proposal as lead. Show the new plan version, reviewer/priority/order changes and audit record. Refresh to demonstrate persistence. The failed CI risk remains until a passing event arrives.
6. Separately reject another proposal and show that the plan version does not advance. Contributors may propose changes but cannot approve them.
7. Show voluntarily reported capacity, task status edits, and invalid dependency cycle rejection. Avoid treating demo availability as real employee information.

GitHub: run `python sync_github.py` from `api` after configuring the exact repository/workflow mapping. A real run is labeled GitHub; sample replay remains separate. Local CLI sync is manual; the public webhook is not deployed.

Keep the seed and current audit history. There is no destructive reset button. Re-running setup preserves existing records. Use the dedicated test database for automated resets. Back up development data before any future reset or migration experiment.

Do not claim a hosted service, measured delivery improvement, model accuracy/cost evaluation, or live AI completion unless those steps have actually been verified.
