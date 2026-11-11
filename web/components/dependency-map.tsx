"use client";
import { useMemo } from "react";
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
} from "@xyflow/react";
import { GitBranch, ArrowUpRight } from "lucide-react";
import type { Graph, Risk, Task } from "@/lib/api";
import { layoutDependencyGraph } from "@/domain/graph-layout";
import { Badge, statusLabels } from "./ui";
import "@xyflow/react/dist/style.css";

type TaskNode = Node<{ task: Task; flag: string; risky: boolean }, "task">;
function TaskCard({ data }: NodeProps<TaskNode>) {
  return (
    <div className={`graph-task ${data.flag} ${data.risky ? "has-risk" : ""}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <small>{data.task.key}</small>
      <strong>{data.task.title}</strong>
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
}: {
  graph: Graph;
  risks: Risk[];
  onSelect: (id: string) => void;
  onOpen?: () => void;
  expanded?: boolean;
}) {
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
        position: layout.positions[task.id],
        data: {
          task,
          risky: riskIds.has(task.id),
          flag: graph.selected_task_id === task.id ? "selected"
            : downstream.has(task.id) ? "affected"
            : upstream.has(task.id) ? "upstream"
            : riskIds.has(task.id) ? "risk" : "",
        },
        draggable: false,
        ariaLabel: `${task.key}: ${task.title}. ${task.status}. Click to inspect dependencies.`,
      };
    });
    const edges = graph.edges.map((edge) => {
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
  }, [graph, risks]);
  return (
    <section className={`panel graph-panel ${expanded ? "expanded" : ""}`}>
      <div className="panel-head">
        <div>
          <span className="section-kicker">CONNECTED WORK</span>
          <h2>Dependency map</h2>
          <p>Work flows left to right. Select any task to see what must happen before and after it.</p>
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
      ) : <><div className="graph-legend" aria-label="Map legend">
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
          nodesDraggable={false}
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
