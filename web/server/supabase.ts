import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_NOT_CONFIGURED");
  const jar = await cookies();
  // Used exclusively by route handlers, so refreshed cookies can always be set.
  return createServerClient(url, key, { cookies: {
    getAll: () => jar.getAll(),
    setAll: values => values.forEach(({ name, value, options }) => jar.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" })),
  }});
}
