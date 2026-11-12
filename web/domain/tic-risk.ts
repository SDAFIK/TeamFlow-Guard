import model from "./models/tic-risk-v1.json";
export type RiskFeatures = {ci_failures:number;blocked:number;review_hours:number;downstream_count:number;deadline_hours:number;capacity_gap:number};
const bounds: Record<keyof RiskFeatures, [number,number]>={ci_failures:[0,5],blocked:[0,1],review_hours:[0,120],downstream_count:[0,8],deadline_hours:[4,120],capacity_gap:[0,1]};
const features=model.features as (keyof RiskFeatures)[];
export function experimentalRisk(input:RiskFeatures) {
  for(const key of features){
    const value=input[key], [min,max]=bounds[key];
    if(!Number.isFinite(value)||value<min||value>max||(["ci_failures","blocked","downstream_count"].includes(key)&&!Number.isInteger(value)))return null;
  }
  const contributions=features.map((feature,i)=>({feature,logit_contribution:model.weights[i]*(input[feature]-model.mean[i])/model.scale[i]}));
  const logit=model.bias+contributions.reduce((sum,c)=>sum+c.logit_contribution,0);
  const score=1/(1+Math.exp(-logit));
  return {model_version:model.version,status:model.status,score,threshold:model.threshold,flagged:score>=model.threshold,contributions,limitations:model.limitations};
}
