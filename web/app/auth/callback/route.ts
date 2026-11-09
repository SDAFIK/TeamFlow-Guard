import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/server/supabase';
export async function GET(request:NextRequest){
  const code=request.nextUrl.searchParams.get('code');
  if(code){
    const client=await supabaseServer();
    const {error}=await client.auth.exchangeCodeForSession(code);
    if(!error)return NextResponse.redirect(new URL('/overview',process.env.APP_BASE_URL??request.nextUrl.origin));
  }
  return NextResponse.redirect(new URL('/login?confirmation=failed',process.env.APP_BASE_URL??request.nextUrl.origin));
}
