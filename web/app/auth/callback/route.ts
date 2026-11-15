import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/server/supabase";
import { authRedirectOrigin } from "@/server/origin";
export async function GET(request:NextRequest){
  const origin=authRedirectOrigin(request.nextUrl.origin,{APP_BASE_URL:process.env.APP_BASE_URL,APP_ALLOWED_ORIGINS:process.env.APP_ALLOWED_ORIGINS,VERCEL:process.env.VERCEL,VERCEL_URL:process.env.VERCEL_URL});
  if(!origin)return new NextResponse("Confirmation is not configured. Contact your workspace owner.",{status:503});
  const code=request.nextUrl.searchParams.get("code");
  if(code){
    const client=await supabaseServer();
    const flowId=request.nextUrl.searchParams.get("sb_flow_id");
    const {data,error}=await client.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);
    if(!error){
      // AuthTokenResponse omits the runtime PKCE redirectType in this pinned SDK.
      if("redirectType" in data && data.redirectType==="recovery"){
        const {data:claims}=await client.auth.getClaims(data.session.access_token);
        const sessionId=claims?.claims?.session_id;
        if(sessionId){
          const response=NextResponse.redirect(new URL("/reset-password",origin));
          response.cookies.set("tf_recovery",String(sessionId),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:600});
          return response;
        }
        await client.auth.signOut({scope:"local"});
        return NextResponse.redirect(new URL("/login?confirmation=failed",origin));
      }
      const response=NextResponse.redirect(new URL("/overview",origin));
      response.cookies.delete("tf_recovery");
      return response;
    }
  }
  // Some Auth versions resend signup confirmation through an implicit link.
  // Supabase verifies the email before redirecting. Never accept fragment tokens
  // or trust the callback as proof of authentication; require password sign-in.
  return NextResponse.redirect(new URL(code?"/login?confirmation=failed":"/login?confirmation=check",origin));
}
