"use client";
import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { GitBranch, ArrowUpRight } from "lucide-react";
import type { Graph, Risk, Task } from "@/lib/api";
import { Badge } from "./ui";
import "@xyflow/react/dist/style.css";

type TaskNode = Node<{ task: Task; flag: string; reverse: boolean }, "task">;
function TaskCard({ data }: NodeProps<TaskNode>) {
  return (
    <div className={`graph-task ${data.flag}`}>
      <Handle type="target" position={data.reverse ? Position.Right : Position.Left} />
      <small>{data.task.key}</small>
      <strong>{data.task.title}</strong>
      <Badge value={data.flag === "risk" ? "at risk" : data.task.status} />
      <Handle type="source" position={data.reverse ? Position.Left : Position.Right} />
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
  const { nodes, edges } = useMemo(() => {
    const levels: Record<string, number> = {};
    graph.nodes.forEach((t) => (levels[t.id] = 0));
    for (let i = 0; i < graph.nodes.length; i++)
      for (const edge of graph.edges)
        levels[edge.successor_id] = Math.max(
          levels[edge.successor_id],
          levels[edge.predecessor_id] + 1,
        );
    const groups: Record<number, number> = {};
    const rowCounts: Record<number, Record<number, number>> = {};
    for (const depth of Object.values(levels)) {
      const row = Math.floor(depth / 3);
      rowCounts[row] ??= {};
      rowCounts[row][depth] = (rowCounts[row][depth] ?? 0) + 1;
    }
    const rowY: Record<number, number> = {0: 0};
    for (let row = 1; row < Object.keys(rowCounts).length; row++)
      rowY[row] = rowY[row - 1] + Math.max(...Object.values(rowCounts[row - 1])) * 125 + 55;
    const riskIds = new Set(
      risks.filter((r) => r.active).map((r) => r.evidence.task_id),
    );
    const nodes: TaskNode[] = graph.nodes.map((task) => {
      const depth = levels[task.id];
      const offset = groups[depth] ?? 0;
      groups[depth] = offset + 1;
      const row = Math.floor(depth / 3);
      const col = row % 2 === 0 ? depth % 3 : 2 - (depth % 3);
      return {
        id: task.id,
        type: "task",
        position: { x: col * 245, y: rowY[row] + offset * 125 },
        data: {
          task,
          reverse: row % 2 !== 0,
          flag: riskIds.has(task.id)
            ? "risk"
            : graph.selected_task_id === task.id
              ? "selected"
              : graph.downstream_ids.includes(task.id)
                ? "affected"
                : "",
        },
        draggable: false,
        ariaLabel: `${task.key}: ${task.title}. ${task.status}`,
      };
    });
    const edges = graph.edges.map((edge) => ({
      id: `${edge.predecessor_id}-${edge.successor_id}`,
      source: edge.predecessor_id,
      target: edge.successor_id,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#4f7785" },
      style: {
        stroke: graph.downstream_ids.includes(edge.successor_id)
          ? "#38d9c3"
          : "#456377",
        strokeWidth: 1.6,
      },
    }));
    return { nodes, edges };
  }, [graph, risks]);
  return (
    <section className={`panel graph-panel ${expanded ? "expanded" : ""}`}>
      <div className="panel-head">
        <div>
          <span className="section-kicker">CONNECTED WORK</span>
          <h2>Dependency map</h2>
          <p>Select a task to trace its downstream impact.</p>
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
      <div className="graph-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          minZoom={0.35}
          maxZoom={1.5}
          nodesConnectable={false}
          nodesDraggable={false}
          onNodeClick={(_, node) => onSelect(node.id)}
          colorMode="dark"
        >
          <Background color="#263849" gap={22} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="graph-caption">
        <span>
          <GitBranch size={15} />
          {graph.edges.length} connections · Plan v{graph.plan_version}
        </span>
        <span>
          {graph.selected_task_id
            ? `${graph.downstream_ids.length} downstream tasks`
            : "Select any task to explore"}
        </span>
      </div>
      <details className="graph-alternative">
        <summary>Accessible task list</summary>
        <div>
          {graph.nodes.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              aria-pressed={graph.selected_task_id === t.id}
            >
              {t.key} · {t.title}
              {graph.downstream_ids.includes(t.id) ? " · downstream" : ""}
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}
