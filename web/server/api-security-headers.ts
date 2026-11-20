/**
 * Security headers for JSON responses containing workspace or identity data.
 * Keep this shared policy in sync with the API gateway.
 */
export const apiSecurityHeaders = Object.freeze({
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
} as const);
