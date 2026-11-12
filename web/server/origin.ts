type OriginConfig = { APP_BASE_URL?: string; APP_ALLOWED_ORIGINS?: string; VERCEL?: string; VERCEL_URL?: string };

// Trust deployment configuration only, never Host or forwarded request headers.
export function allowedOrigin(origin: string | null, config: OriginConfig): boolean {
  if (!origin || origin === "null") return false;
  const configured = [config.APP_BASE_URL, ...(config.APP_ALLOWED_ORIGINS ?? "").split(",")];
  if (config.VERCEL && config.VERCEL_URL) configured.push(`https://${config.VERCEL_URL}`);
  if (!config.VERCEL && !config.APP_BASE_URL) configured.push("http://localhost:3000");
  return configured.some(value => {
    if (!value?.trim()) return false;
    try {
      const url = new URL(value.trim());
      if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return false;
      if (url.protocol !== "https:" && !(url.protocol === "http:" && !config.VERCEL && ["localhost", "127.0.0.1"].includes(url.hostname))) return false;
      return origin === url.origin;
    } catch { return false; }
  });
}

// Preserve the browser's trusted origin for PKCE cookies. Never reflect an arbitrary host.
export function authRedirectOrigin(origin: string | null, config: OriginConfig): string | null {
  if (allowedOrigin(origin, config)) return origin;
  const base = config.APP_BASE_URL;
  try { const canonical = new URL(base ?? "").origin; return allowedOrigin(canonical, config) ? canonical : null; }
  catch { return null; }
}
