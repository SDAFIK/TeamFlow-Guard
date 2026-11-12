// Read-only production diagnostic; always stop before building deployable assets.
const {createClient}=require("@supabase/supabase-js");
const classify=(e)=>{const m=String(e?.message??""),d=String(e?.details??""),c=String(e?.cause?.code??"");return {name:e?.name??null,cause_code:/^[A-Z0-9_]{1,50}$/.test(c)?c:null,fetch_failed:/fetch failed/i.test(m+" "+d),invalid_header:/header|ByteString|invalid character/i.test(m+" "+d),dns:/ENOTFOUND|EAI_AGAIN/i.test(m+" "+d),timeout:/timeout|timed out|ETIMEDOUT/i.test(m+" "+d),tls:/certificate|TLS|SSL/i.test(m+" "+d),network:/ECONN|ENET|socket/i.test(m+" "+d)}};
(async()=>{
 if(process.env.VERCEL_ENV!=="production")throw Error("production diagnostic only");
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.TEAMFLOW_GITHUB_INGEST_KEY;if(!url||!key)throw Error("missing config");
 const u=new URL(url);if(u.hostname!=="iqsbbmwwayepeqwuxscg.supabase.co"||u.protocol!=="https:")throw Error("wrong project");
 console.log("INGEST_CONFIG_SHAPE: "+JSON.stringify({url_path:u.pathname,query_present:!!u.search,key_format:/^sb_secret_[A-Za-z0-9_-]+$/.test(key),key_length:key.length}));
 const args={w:"4a3d61e1-7bdc-4dd3-ab68-67305306ffba",t:"aad66f3f-2728-4105-80b4-603b2d3e4c7d",repo:"SDAFIK/TeamFlow-Guard",workflow_id:416650057,run_id:43324373557,attempt:1,branch:"teamflow-diagnostic-ignored-branch",conclusion:"failure",observed:new Date().toISOString()};
 const rpc=new URL("/rest/v1/rpc/tf_ingest_github_ci",u);
 try{const r=await fetch(rpc,{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify(args),redirect:"error",signal:AbortSignal.timeout(12000)});const x=await r.json().catch(()=>({}));console.log("INGEST_DIRECT_RPC: "+JSON.stringify({http:r.status,code:typeof x.code==="string"&&/^[A-Z0-9_]{1,30}$/.test(x.code)?x.code:null,result:x.status==="ignored_branch"?x.status:null}));}catch(e){console.log("INGEST_DIRECT_RPC_ERROR: "+JSON.stringify(classify(e)));}
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(12000)})}});
 const {data,error,status}=await client.rpc("tf_ingest_github_ci",args);
 console.log("INGEST_SDK_RPC: "+JSON.stringify({http:status,code:error?.code??null,result:data?.status??null,error_class:error?classify(error):null}));
})().catch(e=>console.log("INGEST_DIAGNOSTIC_ERROR: "+JSON.stringify(classify(e)))).finally(()=>{console.log("INGEST_DIAGNOSTIC: intentional build stop; no promotion");process.exit(1);});
