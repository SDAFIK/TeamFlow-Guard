import { githubAppConfig, validWebhookSignature, webhookMatchesBinding } from "@/server/github-app";
import { mappedCI, ingestCI } from "@/server/github-evidence";
import { mappedReviewEvent, reconcileReview, validDeliveryId } from "@/server/github-review-evidence";
import {eventBinding,storedMappingRows} from "@/server/github-workspace-mappings";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
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
  try {
    if(event==="workflow_run"){
      let ci=mappedCI(config,process.env.TEAMFLOW_GITHUB_CI_MAPPINGS,event,payload);
      if(!ci){const b=eventBinding(config,payload);if(b){const stored=await storedMappingRows(b);ci=mappedCI(config,JSON.stringify(stored.ci),event,payload);}}
      if(!ci)return new Response(null,{status:204});
      await ingestCI(ci);
      return new Response(null,{status:202});
    }
    let review=mappedReviewEvent(config,process.env.TEAMFLOW_GITHUB_REVIEW_MAPPINGS,event,payload);
    if(!review){const b=eventBinding(config,payload);if(b){const stored=await storedMappingRows(b);review=mappedReviewEvent(config,JSON.stringify(stored.reviews),event,payload);}}
    if(!review)return new Response(null,{status:204});
    const delivery=request.headers.get("x-github-delivery");
    if(!validDeliveryId(delivery))return new Response(null,{status:400});
    await reconcileReview(config,review,delivery!);
    return new Response(null,{status:202});
  }catch{return new Response(null,{status:503});}
}
