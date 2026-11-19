"use strict";

/**
 * Stage 8 proof manifest guard.
 * It NEVER calls providers, reads credentials, touches production data or interprets
 * local fixture success as real external integration acceptance.
 *
 * A matching manifest is a checklist of human-reviewed evidence references, NOT
 * a cryptographic verification of external-provider events.
 */
const fs = require("node:fs");
const path = require("node:path");

const REQUIRED = Object.freeze([
  { id: "hosted-auth", source: "hosted-auth", label: "Hosted signup, confirmation, resend and password reset" },
  { id: "gemini-provider", source: "provider-request", label: "Actual bounded Gemini structured recovery response" },
  { id: "github-ci", source: "github-delivery", label: "GitHub-originated signed failure, replay and newer passing run" },
  { id: "github-review", source: "github-review", label: "Real GitHub review submission and resulting evidence lifecycle" },
  { id: "email-inbox", source: "recipient-inbox", label: "Invitation delivered to a test recipient inbox" },
  { id: "hosted-multiuser", source: "hosted-isolated", label: "Hosted isolated two-user/outsider permissions and approval" },
]);

const DEMO_SOURCES = /fixture|mock|simulat|intercept|seed|mailpit|local-only/i;
const SAFE_REF = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,120}$/;

function evaluateEvidence(evidence, now = new Date()) {
  const items = Array.isArray(evidence?.checks) ? evidence.checks : [];
  const outcomes = REQUIRED.map(required => {
    const matches = items.filter(entry => entry && entry.id === required.id);
    if (matches.length !== 1) return { id: required.id, label: required.label, state: "PENDING", reason: matches.length ? "Ambiguous evidence entries" : "Real-world proof not recorded" };
    const entry = matches[0];
    const when = typeof entry.observedAt === "string" ? Date.parse(entry.observedAt) : NaN;
    const age = now.getTime() - when;
    if (entry.source !== required.source || DEMO_SOURCES.test(String(entry.source))) return { id: required.id, label: required.label, state: "PENDING", reason: "Source is not the required external source" };
    if (!Number.isFinite(when) || age < 0 || age > 30 * 86400000) return { id: required.id, label: required.label, state: "PENDING", reason: "Missing, future or older-than-30-day observation" };
    // IDs only; no email addresses, full URLs, passwords, cookies or webhook bodies.
    if (typeof entry.evidenceRef !== "string" || !SAFE_REF.test(entry.evidenceRef) || DEMO_SOURCES.test(entry.evidenceRef)) return { id: required.id, label: required.label, state: "PENDING", reason: "Missing or unsafe evidence reference" };
    if (entry.result !== "observed") return { id: required.id, label: required.label, state: "PENDING", reason: "Actual successful observation was not recorded" };
    return { id: required.id, label: required.label, state: "REVIEW_REQUIRED", reason: "Reference recorded; independently review the original event before sign-off" };
  });
  return {
    counts: {
      pending: outcomes.filter(x => x.state === "PENDING").length,
      reviewRequired: outcomes.filter(x => x.state === "REVIEW_REQUIRED").length,
    },
    // No manifest or external-ID claims can automatically satisfy the release gate.
    canCertifyAutomatically: false,
    outcomes,
  };
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help")) {
    console.log("Usage: node scripts/stage8-acceptance-gate.cjs [--evidence path.json]");
    console.log("No provider calls. Manifest references require separate human/external verification. Secrets and user data are forbidden.");
    return 0;
  }
  let evidence = {};
  const p = argv.indexOf("--evidence");
  if (p !== -1) {
    if (typeof argv[p + 1] !== "string" || argv[p + 1].startsWith("--")) {
      console.error("An evidence JSON filepath is required.");
      return 2;
    }
    try {
      const filename = path.resolve(argv[p + 1]);
      if (fs.statSync(filename).size > 16384) throw new Error("Oversized evidence manifest");
      evidence = JSON.parse(fs.readFileSync(filename, "utf8"));
    } catch {
      console.error("Evidence manifest unavailable or malformed. No credentials or contents were printed.");
      return 2;
    }
  }
  const report = evaluateEvidence(evidence);
  for (const item of report.outcomes) console.log(item.id + ": " + item.state + " — " + item.reason);
  console.log("Stage 8 cannot be automatically certified by fixtures, configuration flags or self-attested JSON. Independent real-source review is required.");
  return 1;
}

if (require.main === module) process.exitCode = main();
module.exports = { REQUIRED, evaluateEvidence, main };
