import {it,expect} from "vitest";
import {appRepositoryActivity,githubAppConfig} from "./github-app";
it.skipIf(process.env.TEAMFLOW_GITHUB_LIVE_SMOKE!=="1"||process.env.VERCEL_ENV!=="preview"||process.env.VERCEL_GIT_COMMIT_REF!=="codex/gemini-live-smoke")("authenticates real dedicated GitHub App and reads scoped repository activity",async()=>{
 const workspace="11111111-1111-4111-8111-111111111111";
 const cfg=githubAppConfig();
 try{
  expect(cfg.appId).toBe("5735990");
  const activity=await appRepositoryActivity({...cfg,bindings:JSON.stringify([{workspace_id:workspace,installation_id:181405240,repository_id:1450114794,repository:"SDAFIK/TeamFlow-Guard"}]),webhookSecret:undefined},workspace,"codex/github-live-sandbox");
  expect(activity.warning).toBeNull();
  console.log("GITHUB_APP_SMOKE: PASS real scoped installation token, repository identity, Actions and pull requests verified; workflow_count="+activity.runs.length+"; pull_count="+activity.pulls.length);
 }catch{throw Error("GITHUB_APP_SMOKE: FAIL authentication, scoped repository access or activity request failed");}
},40000);
