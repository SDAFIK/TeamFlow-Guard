import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/server/supabase";
import { authRedirectOrigin } from "@/server/origin";
export async function GET(request:NextRequest){
  const origin=authRedirectOrigin(request.nextUrl.origin,{APP_BASE_URL:process.env.APP_BASE_URL,APP_ALLOWED_ORIGINS:process.env.APP_ALLOWED_ORIGINS,VERCEL:process.env.VERCEL,VERCEL_URL:process.env.VERCEL_URL});
  if(!origin)return new NextResponse("Confirmation is not configured. Contact your workspace owner.",{status:503});
  const code=request.nextUrl.searchParams.get("code");
  if(code){
    const client=await supabaseServer();
    const {data,error}=await client.auth.exchangeCodeForSession(code);
    if(!error){
      if(data.redirectType==="PASSWORD_RECOVERY"){
        const {data:claims}=await client.auth.getClaims();
        const sessionId=claims?.claims?.session_id;
        if(sessionId){
          const response=NextResponse.redirect(new URL("/reset-password",origin));
          response.cookies.set("tf_recovery",String(sessionId),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:600});
          return response;
        }
        await client.auth.signOut({scope:"local"});
        return NextResponse.redirect(new URL("/login?confirmation=failed",origin));
      }
      return NextResponse.redirect(new URL("/overview",origin));
    }
  }
  return NextResponse.redirect(new URL("/login?confirmation=failed",origin));
}
