'use client';

import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { SandboxArtifactData, SandboxRun } from '@/lib/project-sandbox';
import './workflow-workspace.css';

type ExploreNode = Node<{ label: string; operation: string; number: number; result?: string; active: boolean; incoming: Position; outgoing: Position; inspect: () => void }, 'explore'>;

function ExplorationNode({ data }: NodeProps<ExploreNode>) {
  return <div className="guided-canvas-node" data-active={data.active}>
    <Handle type="target" position={data.incoming} isConnectable={false} />
    <button className="nodrag nopan" onClick={event => { event.stopPropagation(); data.inspect(); }} aria-label={`Inspect ${data.label}`} aria-pressed={data.active}>
      <span className="guided-canvas-operation">{data.number}. {data.operation}</span>
      <strong>{data.label}</strong>
      <span className="guided-canvas-value">{data.result ?? 'Run an example'}</span>
    </button>
    <Handle type="source" position={data.outgoing} isConnectable={false} />
  </div>;
}
const nodeTypes = { explore: ExplorationNode };

/** The same canvas library as the agent project, with no authoring controls. */
export function GuidedWorkflowCanvas({ artifact, activeIds, run, onInspect, disabled }: {
  artifact: SandboxArtifactData; activeIds: string[]; run?: SandboxRun; onInspect: (stepId: string) => void; disabled: boolean;
}) {
  const nodes: ExploreNode[] = artifact.steps.map((step, i) => {
    const row = Math.floor(i / 3);
    const column = row % 2 ? 2 - i % 3 : i % 3;
    return { id: step.id, type: 'explore', position: { x: column * 215, y: row * 155 },
      data: { label: step.output, operation: step.operation, number: i + 1, active: activeIds.includes(step.id),
        incoming: i % 3 === 0 ? Position.Top : row % 2 ? Position.Right : Position.Left,
        outgoing: i % 3 === 2 ? Position.Bottom : row % 2 ? Position.Left : Position.Right,
        result: run ? JSON.stringify(run.outputs[step.output]) : undefined,
        inspect: () => { if (!disabled) onInspect(step.id); } },
    };
  });
  // Arrows show execution order, including independent transformations.
  const edges = artifact.steps.slice(1).map((step, i) => ({ id: `order-${step.id}`, source: artifact.steps[i]!.id, target: step.id,
    type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed }, selectable: false, focusable: false,
    style: { stroke: activeIds.includes(step.id) ? 'var(--accent)' : 'var(--muted)' },
  }));
  return <section className="guided-canvas-section" aria-label="Ready-made workflow canvas">
    <div className="guided-canvas-heading"><h2>Explore the workflow</h2><p>Select a step to inspect it. Arrows show execution order.</p></div>
    <div className="workflow-canvas guided-canvas">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={(_, node) => node.data.inspect()} fitView fitViewOptions={{ padding: .15 }} minZoom={.35} maxZoom={1.6}
        nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false} elementsSelectable={false}
        deleteKeyCode={null} colorMode="dark" preventScrolling={false}>
        <Background gap={20} color="var(--line)" /><Controls showInteractive={false} />
      </ReactFlow>
    </div>
    <p className="guided-canvas-caption">Ready-made workflow · {artifact.steps.length} steps · Select, run and explain</p>
  </section>;
}
