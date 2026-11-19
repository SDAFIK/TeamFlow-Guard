import {describe,expect,it} from "vitest";
import {aiReadinessDiagnostic, githubReadinessDiagnostic, type GithubReadinessSnapshot} from "./integration-readiness";

const ready:GithubReadinessSnapshot={
 repository:"demo-org/roadmap",app_bound:true,app_credentials:true,
 webhook_configured:true,ingestion_configured:true,is_demo:false,
 mappings:[{valid:true}],review_mappings:[],
};

describe("GitHub readiness messaging",()=>{
  it("labels demo evidence fictional even when settings appear configured",()=>{
    const x=githubReadinessDiagnostic({...ready,is_demo:true});
    expect(x.stage).toBe("sample"); expect(x.explanation).toContain("No live GitHub");
  });
  it("distinguishes no link from a read-only public link",()=>{
    expect(githubReadinessDiagnostic({...ready,repository:null}).stage).toBe("unlinked");
    const x=githubReadinessDiagnostic({...ready,app_bound:false,app_credentials:false});
    expect(x.stage).toBe("public");
    expect(x.explanation).toContain("does not enable signed webhook");
  });
  it.each(["app_credentials","webhook_configured","ingestion_configured"] as const)(
    "flags %s missing without exposing or requesting secret values",key=>{
      const x=githubReadinessDiagnostic({...ready,[key]:false});
      expect(x.stage).toBe("setup");expect(x.nextAction).toContain("Do not paste secrets");
    }
  );
  it("requires at least one valid mapping, and accepts mapped reviews without mapped workflows",()=>{
    expect(githubReadinessDiagnostic({...ready,mappings:[]}).stage).toBe("setup");
    expect(githubReadinessDiagnostic({...ready,mappings:[{valid:false}]}).stage).toBe("setup");
    expect(githubReadinessDiagnostic({...ready,mappings:[],review_mappings:[{valid:true}]}).stage).toBe("configured");
    expect(githubReadinessDiagnostic({...ready,review_mappings:[{valid:false}]}).stage).toBe("setup");
  });
  it("does not equate fully configured settings to a successful webhook delivery",()=>{
    const x=githubReadinessDiagnostic(ready);
    expect(x.stage).toBe("configured");
    expect(x.explanation).toContain("does not prove");
    expect(x.nextAction).toContain("recent webhook deliveries");
  });
});

describe("AI readiness messages",()=>{
  it("reports configured Gemini without claiming live connectivity",()=>{
    const x=aiReadinessDiagnostic({ai_configured:true,ai_provider:"gemini"});
    expect(x.label).toContain("not live-verified");
    expect(x.explanation).toContain("not established");
  });
  it("offers offline rule-based recovery when AI is not configured",()=>{
    const x=aiReadinessDiagnostic({ai_configured:false,ai_provider:"gemini"});
    expect(x.stage).toBe("setup");
    expect(x.nextAction).toContain("rule-based");
  });
  it("names the configured provider when OpenAI is selected",()=>{
    expect(aiReadinessDiagnostic({ai_configured:true,ai_provider:"openai"}).label).toContain("OpenAI");
  });
});
