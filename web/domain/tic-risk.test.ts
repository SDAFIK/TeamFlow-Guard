import { expect,it } from "vitest";
import { experimentalRisk } from "./tic-risk";
const low={ci_failures:0,blocked:0,review_hours:0,downstream_count:0,deadline_hours:120,capacity_gap:0};
const high={ci_failures:5,blocked:1,review_hours:120,downstream_count:8,deadline_hours:4,capacity_gap:1};
it("reproduces exported model scores and labels them experimental",()=>{const a=experimentalRisk(low)!,b=experimentalRisk(high)!;expect(a.score).toBeCloseTo(0.026508541386844674,10);expect(b.score).toBeCloseTo(0.9978495020024082,10);expect(a.flagged).toBe(false);expect(b.flagged).toBe(true);expect(b.status).toBe("experimental_synthetic_only");expect(b.contributions).toHaveLength(6);});
it("abstains on invalid or out-of-distribution values",()=>{expect(experimentalRisk({...low,deadline_hours:0})).toBeNull();expect(experimentalRisk({...low,blocked:.5})).toBeNull();expect(experimentalRisk({...low,capacity_gap:NaN})).toBeNull();expect(experimentalRisk({...low,ci_failures:6})).toBeNull();});
it("monotonic risk increases with CI failures for fixed other features",()=>{expect(experimentalRisk({...low,ci_failures:3})!.score).toBeGreaterThan(experimentalRisk(low)!.score);});
