const {spawnSync}=require("node:child_process");
if(process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="codex/tic-demo-gemini-smoke"){
 if(!process.env.GEMINI_API_KEY||!process.env.GEMINI_MODEL){console.error("TIC_DEMO_GEMINI: missing configuration");process.exit(1);}
 const result=spawnSync(process.execPath,["node_modules/vitest/vitest.mjs","run","server/tic-demo-gemini-live.test.ts"],{stdio:"inherit",env:{...process.env,TEAMFLOW_TIC_DEMO_LIVE:"1"}});
 process.exitCode=result.status??1;
}
