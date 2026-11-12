// Read-only model discovery, no generation and no database calls.
if(process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="codex/gemini-live-smoke"){
 (async()=>{
  if(!process.env.GEMINI_API_KEY)throw Error("missing key");
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",{headers:{"x-goog-api-key":process.env.GEMINI_API_KEY},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error("model listing HTTP "+response.status);
  const data=await response.json();
  const models=(data.models??[]).filter(m=>m.supportedGenerationMethods?.includes("generateContent")).map(m=>m.name).filter(n=>typeof n==="string"&&/^models\/[a-zA-Z0-9._-]+$/.test(n));
  console.log("GEMINI_SUPPORTED_MODELS: "+JSON.stringify(models));
  console.log("GEMINI_CONFIGURED_MODEL: "+(/^(models\/)?[a-zA-Z0-9._-]+$/.test(process.env.GEMINI_MODEL??"")?process.env.GEMINI_MODEL:"invalid format"));
 })().catch(e=>{console.error("GEMINI_DISCOVERY: FAIL "+(e instanceof Error&&/^model listing HTTP \d+$/.test(e.message)?e.message:"Model discovery unavailable"));process.exitCode=1;});
}
