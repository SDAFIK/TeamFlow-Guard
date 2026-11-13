export type Edge = { predecessor_id: string; successor_id: string };
function adjacency(ids:string[],edges:Edge[],reverse=false){
 const known=new Set(ids),out=new Map(ids.map(id=>[id,[] as string[]])),degree=new Map(ids.map(id=>[id,0])),unique=new Set<string>();
 if(known.size!==ids.length)throw Error("Duplicate task identifier");
 for(const e of edges){const from=reverse?e.successor_id:e.predecessor_id,to=reverse?e.predecessor_id:e.successor_id;
  if(!known.has(from)||!known.has(to)||from===to)throw Error("Invalid dependency");
  const key=JSON.stringify([from,to]);if(unique.has(key))throw Error("This dependency already exists");unique.add(key);
  out.get(from)!.push(to);degree.set(to,degree.get(to)!+1);
 }return {known,out,degree};
}
export function downstream(ids:string[],edges:Edge[],selected:string,reverse=false):string[]{
 const {known,out}=adjacency(ids,edges,reverse);if(!known.has(selected))throw Error("Task is unavailable");
 const seen=new Set([selected]),queue=[selected];for(let i=0;i<queue.length;i++)for(const next of out.get(queue[i])!){if(!seen.has(next)){seen.add(next);queue.push(next);}}
 return queue.slice(1);
}
export function validateGraph(ids:string[],edges:Edge[]){
 const {out,degree}=adjacency(ids,edges),queue=ids.filter(id=>degree.get(id)===0);
 for(let i=0;i<queue.length;i++)for(const next of out.get(queue[i])!){const value=degree.get(next)!-1;degree.set(next,value);if(value===0)queue.push(next);}
 if(queue.length!==ids.length)throw Error("Dependency would create a cycle");
}
