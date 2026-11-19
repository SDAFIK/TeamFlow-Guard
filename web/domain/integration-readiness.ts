/** Explain existing configuration metadata without testing credentials or calling external providers. */
export type GithubReadinessSnapshot = {
  repository: string | null;
  app_bound: boolean;
  app_credentials: boolean;
  webhook_configured: boolean;
  ingestion_configured: boolean;
  is_demo: boolean;
  mappings: readonly {valid:boolean}[];
  review_mappings?: readonly {valid:boolean}[];
};
export type Diagnostic = {
  label: string;
  explanation: string;
  nextAction: string;
  stage: "sample" | "unlinked" | "public" | "setup" | "configured";
};

export function githubReadinessDiagnostic(status: GithubReadinessSnapshot): Diagnostic {
  if (status.is_demo) return {
    stage:"sample", label:"Fictional demonstration",
    explanation:"Demo evidence is seeded or replayed. No live GitHub events are ingested.",
    nextAction:"Open a real workspace to configure a public link or an administrator-authorized GitHub App.",
  };
  if (!status.repository) return {
    stage:"unlinked", label:"Repository not connected",
    explanation:"There is no repository configured for this workspace.",
    nextAction:"Link a public repository below, or ask an administrator to authorize and bind a GitHub App installation.",
  };
  if (!status.app_bound) return {
    stage:"public", label:"Public repository view",
    explanation:"Read-only public workflow status can be displayed. This does not enable signed webhook evidence ingestion.",
    nextAction:"For evidence-linked risks, an administrator must configure and bind a GitHub App with signed webhook ingestion.",
  };
  if (!status.app_credentials || !status.webhook_configured || !status.ingestion_configured) return {
    stage:"setup", label:"GitHub App setup incomplete",
    explanation:"A repository is bound, but one or more required server-side GitHub App or ingestion settings are missing.",
    nextAction:"Ask the deployment administrator to review app credentials, webhook signing, and evidence ingestion configuration. Do not paste secrets into this workspace.",
  };
  const mappings=[...status.mappings,...(status.review_mappings??[])];
  if (!mappings.length || mappings.some(m=>!m.valid)) return {
    stage:"setup", label:"Evidence mapping needs review",
    explanation:"Signed ingestion settings exist, but no valid workflow/review-to-task mapping is available for dependable linked evidence.",
    nextAction:"A workspace manager can map authorized workflows or requested reviews to saved tasks in the mapping panel below.",
  };
  return {
    stage:"configured", label:"Configuration checks complete",
    explanation:"GitHub App, signed ingestion, and task mappings are configured. This does not prove a webhook was delivered successfully.",
    nextAction:"Check recent webhook deliveries and evidence records below. Use the tracked branch and an authorized test event to verify live activity.",
  };
}

export type AiReadiness = {ai_configured:boolean;ai_provider:string|null};
export function aiReadinessDiagnostic(status: AiReadiness): Diagnostic {
  const provider=status.ai_provider==="openai"?"OpenAI":"Gemini";
  return status.ai_configured?{
    stage:"configured",label:provider+" configured — not live-verified",
    explanation:"The server reports AI settings are present; provider access, quota, latency, and response validity are not established by this check.",
    nextAction:"Open an active risk to request analysis when appropriate. Rule-based recovery is available without an AI request.",
  }:{
    stage:"setup",label:provider+" not configured",
    explanation:"No AI model request is available from this workspace configuration.",
    nextAction:"Use rule-based recovery now. A deployment administrator can configure the provider securely; no secret should be entered here.",
  };
}
