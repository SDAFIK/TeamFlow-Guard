import {it,expect} from "vitest";
import {scoreV2,v2ModelInfo} from "./tic-v2-model";
import model from "./models/tic-v2-synthetic.json";
it("matches Python held-out inference",()=>expect(scoreV2(model.parity_input,true).prediction?.score).toBeCloseTo(model.parity_probability,12));
it("abstains for incomplete, non-finite, outside-domain or real inputs",()=>{for(const input of [[],model.parity_input.map((x,i)=>i===0?NaN:x),model.parity_input.map((x,i)=>i===0?99:x)])expect(scoreV2(input,true).prediction).toBeNull();expect(scoreV2(model.parity_input,false).prediction).toBeNull();expect(v2ModelInfo.automatic_promotion).toBe(false);});
