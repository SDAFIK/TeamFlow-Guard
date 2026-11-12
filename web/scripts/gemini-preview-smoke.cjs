const {spawnSync}=require("node:child_process");
if(process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="codex/gemini-live-smoke"){
 if(!process.env.GITHUB_APP_ID||!process.env.GITHUB_APP_PRIVATE_KEY){console.error("GITHUB_APP_SMOKE: missing configuration");process.exit(1);}
 const result=spawnSync(process.execPath,["node_modules/vitest/vitest.mjs","run","server/github-app-live-smoke.test.ts"],{stdio:"inherit",env:{...process.env,TEAMFLOW_GITHUB_LIVE_SMOKE:"1"}});
 process.exitCode=result.status??1;
}
