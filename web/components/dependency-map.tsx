"use client";
import { useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  type Edge,
} from "@xyflow/react";
import { GitBranch, ArrowUpRight, Maximize2, RotateCcw } from "lucide-react";
import type { Graph, Risk, Task, Person } from "@/lib/api";
import { layoutDependencyGraph } from "@/domain/graph-layout";
import { Badge, statusLabels } from "./ui";
import "@xyflow/react/dist/style.css";

type TaskNode = Node<{ task: Task; flag: string; risky: boolean; owner: string; dimmed: boolean }, "task">;
function TaskCard({ data }: NodeProps<TaskNode>) {
  return (
    <div className={`graph-task ${data.flag} ${data.risky ? "has-risk" : ""} ${data.dimmed?"dimmed":""}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <small>{data.task.key}</small>
      <strong>{data.task.title}</strong>
      <span className="graph-owner">{data.owner}</span>
      <Badge value={data.flag === "risk" ? "at risk" : data.task.status} />
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
const nodeTypes = { task: TaskCard };
export default function DependencyMap({
  graph,
  risks,
  onSelect,
  onOpen,
  expanded = false,
  members = [],
  onOpenTask,
}: {
  graph: Graph;
  risks: Risk[];
  onSelect: (id: string) => void;
  onOpen?: () => void;
  expanded?: boolean;
  members?: Person[];
  onOpenTask?: (id:string)=>void;
}) {
  const [positions,setPositions]=useState<Record<string,{x:number;y:number}>>({});
  const flow=useRef<ReactFlowInstance<TaskNode>|null>(null);
  const selected=graph.nodes.find(t=>t.id===graph.selected_task_id);
  const fit=()=>void flow.current?.fitView({padding:.22,maxZoom:1.1,duration:0});
  const reset=()=>{setPositions({});requestAnimationFrame(fit);};
  const focus=(id:string)=>{onSelect(id);if(id)void flow.current?.fitView({nodes:[{id}],padding:.45,maxZoom:1.2,duration:0});};
  const { nodes, edges, invalid } = useMemo(() => {
    const layout = layoutDependencyGraph(graph.nodes, graph.edges);
    const riskIds = new Set(
      risks.filter((r) => r.active).map((r) => r.evidence.task_id),
    );
    const upstream = new Set(graph.upstream_ids);
    const downstream = new Set(graph.downstream_ids);
    const nodes: TaskNode[] = graph.nodes.map((task) => {
      return {
        id: task.id,
        type: "task",
        position: positions[task.id]??layout.positions[task.id],
        data: {
          task,
          owner: members.find(m=>m.id===task.owner_id)?.name??"Unassigned",
          dimmed: Boolean(graph.selected_task_id&&graph.selected_task_id!==task.id&&!upstream.has(task.id)&&!downstream.has(task.id)&&!riskIds.has(task.id)),
          risky: riskIds.has(task.id),
          flag: graph.selected_task_id === task.id ? "selected"
            : downstream.has(task.id) ? "affected"
            : upstream.has(task.id) ? "upstream"
            : riskIds.has(task.id) ? "risk" : "",
        },
        draggable: expanded,
        ariaLabel: `${task.key}: ${task.title}. ${task.status}. Click to inspect dependencies.`,
      };
    });
    const edges: Edge[] = graph.edges.map((edge) => {
      const onImpactPath = graph.selected_task_id &&
        (edge.predecessor_id === graph.selected_task_id || downstream.has(edge.predecessor_id)) &&
        downstream.has(edge.successor_id);
      const onPrerequisitePath = graph.selected_task_id &&
        upstream.has(edge.predecessor_id) &&
        (edge.successor_id === graph.selected_task_id || upstream.has(edge.successor_id));
      const color = onImpactPath ? "#32d5b5" : onPrerequisitePath ? "#80aaf6" : "#52718a";
      return {
      id: `${edge.predecessor_id}-${edge.successor_id}`,
      source: edge.predecessor_id,
      target: edge.successor_id,
      type: "smoothstep",
      animated: Boolean(onImpactPath),
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: {
        stroke: color,
        strokeWidth: onImpactPath || onPrerequisitePath ? 2.6 : 1.5,
        opacity: graph.selected_task_id && !onImpactPath && !onPrerequisitePath ? 0.48 : 1,
      },
    }; });
    return { nodes, edges, invalid: layout.invalid };
  }, [graph, risks, positions, members, expanded]);
  return (
    <section className={`panel graph-panel ${expanded ? "expanded" : ""}`}>
      <div className="panel-head">
        <div>
          <span className="section-kicker">CONNECTED WORK</span>
          <h2>Dependency map</h2>
          <p>{expanded?"Explore the saved dependency network. Drag cards to arrange your view, or select a task to trace its impact.":"Work flows left to right. Select a task to trace its dependencies."}</p>
        </div>
        {onOpen && (
          <button
            className="icon-button"
            aria-label="Open dependencies"
            onClick={onOpen}
          >
            <ArrowUpRight size={20} />
          </button>
        )}
      </div>
      {graph.nodes.length === 0 ? (
        <div className="graph-empty"><GitBranch size={30}/><h3>No tasks to connect yet</h3><p>Add your first task. The dependency map will show saved tasks and their connections.</p></div>
      ) : <>{expanded&&<div className="graph-tools"><label>Find a task<select aria-label="Find dependency task" value={graph.selected_task_id??""} onChange={e=>focus(e.target.value)}><option value="">All tasks</option>{graph.nodes.map(t=><option key={t.id} value={t.id}>{t.key} · {t.title}</option>)}</select></label><button className="secondary" onClick={fit}><Maximize2 size={15}/> Fit all</button><button className="secondary" onClick={reset}><RotateCcw size={15}/> Reset layout</button></div>}<div className="graph-legend" aria-label="Map legend">
        <span><i className="legend-dot selected"/> Selected</span>
        <span><i className="legend-dot upstream"/> Prerequisite</span>
        <span><i className="legend-dot affected"/> Downstream</span>
        <span><i className="legend-dot risk"/> Risk</span>
      </div>
      {invalid && <p role="alert" className="error">Some saved links are invalid or cyclic. The map is showing a safe fallback layout; ask a manager to review dependencies.</p>}
      <div className="graph-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.22, maxZoom: 1.05 }}
          minZoom={0.2}
          maxZoom={1.8}
          nodesConnectable={false}
          nodesDraggable={expanded}
          onInit={instance=>{flow.current=instance;}}
          onNodeDrag={(_,node)=>setPositions(prev=>({...prev,[node.id]:node.position}))}
          onNodeDragStop={(_,node)=>setPositions(prev=>({...prev,[node.id]:node.position}))}
          onPaneClick={()=>onSelect("")}
          onNodeClick={(_, node) => onSelect(node.id)}
          nodesFocusable
          colorMode="dark"
        >
          <Background color="#263849" gap={22} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="graph-minimap" nodeColor={node => {
            const flag = (node.data as TaskNode["data"]).flag;
            return flag === "selected" ? "#32d5b5" : flag === "affected" ? "#e0ad69" : flag === "upstream" ? "#80aaf6" : "#52718a";
          }}/>
        </ReactFlow>
      </div></>}
      <div className="graph-caption">
        <span>
          <GitBranch size={15} />
          {graph.edges.length} connections · Plan v{graph.plan_version}
        </span>
        <span>
          {graph.selected_task_id
            ? `${graph.upstream_ids.length} prerequisites · ${graph.downstream_ids.length} downstream tasks`
            : graph.edges.length === 0 ? "No links yet — propose a dependency to begin" : "Select any task to explore"}
        </span>
      </div>
      {expanded&&selected&&<div className="graph-inspector" aria-label="Selected task impact"><div className="graph-inspector-head"><div><span className="section-kicker">SELECTED TASK</span><h3>{selected.key} · {selected.title}</h3><p>{members.find(m=>m.id===selected.owner_id)?.name??"Unassigned"} · {statusLabels[selected.status]??selected.status}</p></div>{onOpenTask&&<button className="secondary" onClick={()=>onOpenTask(selected.id)}>Open task <ArrowUpRight size={16}/></button>}</div><div className="graph-impact-columns">{[{title:"Prerequisites",ids:graph.upstream_ids},{title:"Downstream impact",ids:graph.downstream_ids}].map(group=><div key={group.title}><h3>{group.title} · {group.ids.length}</h3>{group.ids.length?group.ids.map(id=>{const task=graph.nodes.find(t=>t.id===id);return task&&<button key={id} onClick={()=>focus(id)}>{task.key} · {task.title}</button>;}):<p>No linked tasks in this direction.</p>}</div>)}</div><p className="field-help">Dragging changes only your temporary visual arrangement, not approved dependencies. Use Propose dependency to change the plan.</p></div>}
      <details className="graph-alternative" open={expanded ? true : undefined}>
        <summary>Task list and impact details</summary>
        <div>
          {graph.nodes.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              aria-pressed={graph.selected_task_id === t.id}
            >
              {t.key} · {t.title} · {statusLabels[t.status] ?? t.status}
              {graph.selected_task_id === t.id ? " · selected" : graph.downstream_ids.includes(t.id) ? " · downstream" : ""}
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}
