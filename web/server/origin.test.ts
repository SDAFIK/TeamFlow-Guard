import { expect, it } from "vitest";
import { allowedOrigin, authRedirectOrigin } from "./origin";
const config = { VERCEL: "1", APP_BASE_URL: "https://teamflow-guard-sadib-dewans-projects.vercel.app", APP_ALLOWED_ORIGINS: "https://teamflow-guard.vercel.app", VERCEL_URL: "teamflow-guard-specific.vercel.app" };
it.each([config.APP_BASE_URL,config.APP_ALLOWED_ORIGINS,`https://${config.VERCEL_URL}`])('accepts configured deployment origin %s', origin => expect(allowedOrigin(origin,config)).toBe(true));
it.each([null,"null","https://evil.example","https://teamflow-guard.vercel.app.evil.example","https://unrelated.vercel.app","http://teamflow-guard.vercel.app","https://teamflow-guard.vercel.app:444","http://localhost:3000"])('rejects untrusted origin %s',origin=>expect(allowedOrigin(origin,config)).toBe(false));
it('keeps local development working',()=>expect(allowedOrigin('http://localhost:3000',{})).toBe(true));
it('fails closed without production configuration',()=>expect(allowedOrigin('http://localhost:3000',{VERCEL:'1'})).toBe(false));
it('normalizes a configured trailing slash',()=>expect(allowedOrigin('https://example.com',{APP_BASE_URL:'https://example.com/'})).toBe(true));
it('rejects configuration containing a path or credentials',()=>{expect(allowedOrigin('https://example.com',{APP_BASE_URL:'https://example.com/path'})).toBe(false);expect(allowedOrigin('https://example.com',{APP_BASE_URL:'https://user@example.com'})).toBe(false);});

it("preserves the trusted signup hostname for confirmation cookies",()=>expect(authRedirectOrigin("https://teamflow-guard.vercel.app",config)).toBe("https://teamflow-guard.vercel.app"));
it("does not use a foreign callback host",()=>expect(authRedirectOrigin("https://evil.example",config)).toBe(config.APP_BASE_URL));
it("does not fall back to localhost on production",()=>expect(authRedirectOrigin("http://127.0.0.1:3001",{VERCEL:"1",APP_BASE_URL:"http://127.0.0.1:3001"})).toBeNull());
