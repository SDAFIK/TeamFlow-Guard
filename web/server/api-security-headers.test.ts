import { describe, expect, it } from "vitest";
import { apiSecurityHeaders } from "./api-security-headers";

describe("API JSON response security headers", () => {
  it("disables shared and browser caching for workspace responses", () => {
    expect(apiSecurityHeaders["Cache-Control"]).toContain("private");
    expect(apiSecurityHeaders["Cache-Control"]).toContain("no-store");
  });

  it("prevents MIME sniffing and framing", () => {
    expect(apiSecurityHeaders["X-Content-Type-Options"]).toBe("nosniff");
    expect(apiSecurityHeaders["X-Frame-Options"]).toBe("DENY");
  });

  it("limits referrer disclosure", () => {
    expect(apiSecurityHeaders["Referrer-Policy"]).toBe("same-origin");
  });
});
