// Intentionally never produces a deployable build. Read-only diagnostic: one ignored-branch RPC.
const {createClient}=require("@supabase/supabase-js");
(async()=>{
 if(process.env.VERCEL_ENV!=="production")throw Error("production diagnostic only");
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.TEAMFLOW_GITHUB_INGEST_KEY;
 console.log("INGEST_DIAGNOSTIC_CONFIG: "+JSON.stringify({url_present:!!url,key_present:!!key,key_kind:key?.startsWith("sb_secret_")?"secret":key?.startsWith("eyJ")?"jwt":"other",key_whitespace:key!==key?.trim(),url_host:url?new URL(url).hostname:null}));
 if(!url||!key)throw Error("missing configuration");
 const args={w:"4a3d61e1-7bdc-4dd3-ab68-67305306ffba",t:"aad66f3f-2728-4105-80b4-603b2d3e4c7d",repo:"SDAFIK/TeamFlow-Guard",workflow_id:416650057,run_id:43324373557,attempt:1,branch:"teamflow-diagnostic-ignored-branch",conclusion:"failure",observed:new Date().toISOString()};
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error,status}=await client.rpc("tf_ingest_github_ci",args);
 console.log("INGEST_DIAGNOSTIC_RPC: "+JSON.stringify({http:status,code:error?.code??null,message_class:error?(error.message?.includes("Invalid API key")?"invalid_api_key":error.message?.includes("permission denied")?"permission_denied":error.message?.includes("JWT")?"jwt_error":error.message?.includes("schema cache")?"schema_cache":"other"):null,result:data?.status??null}));
})().catch(()=>console.log("INGEST_DIAGNOSTIC: failed before RPC")).finally(()=>{console.log("INGEST_DIAGNOSTIC: intentional build stop; production alias must not change");process.exit(1);});
