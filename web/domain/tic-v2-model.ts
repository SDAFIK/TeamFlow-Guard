import model from "./models/tic-v2-synthetic.json";
export function scoreV2(values:unknown,fictional:boolean){
 if(!fictional)return {prediction:null,reason:"real_world_validation_required"};
 if(!Array.isArray(values)||values.length!==model.features.length||values.some((v,i)=>typeof v!=="number"||!Number.isFinite(v)||v<model.training_min[i]||v>model.training_max[i]))return {prediction:null,reason:"missing_or_outside_training_domain"};
 const contributions=model.features.map((feature,i)=>({feature,logit_contribution:model.weights[i]*(values[i]-model.mean[i])/model.scale[i]}));
 const score=1/(1+Math.exp(-(model.bias+contributions.reduce((sum,c)=>sum+c.logit_contribution,0))));
 return {prediction:{model_version:model.version,status:model.status,score,flagged:score>=model.threshold,threshold:model.threshold,contributions},reason:"synthetic_experiment"};
}
export const v2ModelInfo={version:model.version,status:model.status,features:model.features,test_metrics:model.test_metrics,threshold:model.threshold,automatic_promotion:false,real_predictions_enabled:false};
