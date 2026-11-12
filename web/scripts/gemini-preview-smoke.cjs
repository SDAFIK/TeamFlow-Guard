// Dedicated diagnostic preview only. One synthetic generation with a free-tier model.
const {spawnSync}=require("node:child_process");
if(process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="codex/gemini-live-smoke"){
 if(!process.env.GEMINI_API_KEY){console.error("GEMINI_LIVE_SMOKE: missing key");process.exit(1);}
 const result=spawnSync(process.execPath,["node_modules/vitest/vitest.mjs","run","server/gemini-live-smoke.test.ts"],{stdio:"inherit",env:{...process.env,GEMINI_MODEL:"gemini-3.1-flash-lite",TEAMFLOW_GEMINI_LIVE_SMOKE:"1"}});
 process.exitCode=result.status??1;
}
