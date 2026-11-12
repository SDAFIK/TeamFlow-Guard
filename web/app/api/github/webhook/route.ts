import { githubAppConfig, validWebhookSignature, webhookMatchesBinding } from "@/server/github-app";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request:Request) {
  const config=githubAppConfig();
  if(!config.webhookSecret?.trim())return new Response(null,{status:503});
  const limit=1_048_576;
  if(Number(request.headers.get("content-length")??0)>limit)return new Response(null,{status:413});
  const reader=request.body?.getReader();
  if(!reader)return new Response(null,{status:400});
  const chunks:Uint8Array[]=[];let size=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
      if(size>limit){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}
  }catch{return new Response(null,{status:400});}
  const raw=Buffer.concat(chunks);
  if(!validWebhookSignature(raw,request.headers.get("x-hub-signature-256"),config.webhookSecret))return new Response(null,{status:401});
  const event=request.headers.get("x-github-event")??"";
  if(event==="ping")return new Response(null,{status:204});
  let payload:unknown;
  try{payload=JSON.parse(raw.toString("utf8"));}catch{return new Response(null,{status:400});}
  try{if(!webhookMatchesBinding(config,event,payload))return new Response(null,{status:204});}catch{return new Response(null,{status:503});}
  // GitHub retains delivery receipts. No task/evidence mutation or payload persistence.
  return new Response(null,{status:202});
}
