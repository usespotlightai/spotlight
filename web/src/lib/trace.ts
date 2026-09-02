import type { TaskTraceResponseDto, TraceNodeResponseDto } from '@/lib/api';

/**
 * The trace as the control plane assembled it. What a phase is, and when a
 * span and a step are the same call, is settled there; what is left here is
 * what it takes to draw one: searching, folding, and where a bar sits.
 */
export type Trace = TaskTraceResponseDto;

export type TraceNode = TraceNodeResponseDto;

export interface Row {
  readonly node: TraceNode;
  readonly depth: number;
  readonly children: number;
}

const at = (iso: string): number => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
};

/** Whether a row says anything about what was searched for. */
export const says = (node: TraceNode, query: string): boolean => {
  const looking = query.trim().toLowerCase();
  if (!looking) {
    return true;
  }

  const held = [
    node.name,
    node.step?.text,
    node.step?.detail,
    node.step?.tool,
    node.span?.name,
    ...(node.step?.locations ?? []).map((where) => where.path),
    ...(node.span?.attributes ?? []).map(
      (each) => `${each.name} ${each.value}`,
    ),
  ];

  return held.some((each) => each?.toLowerCase().includes(looking));
};

/** A row matching, or holding anything that matches, stays. */
const kept = (node: TraceNode, query: string): TraceNode | null => {
  const children = node.children.flatMap((child) => {
    const held = kept(child, query);
    return held ? [held] : [];
  });

  if (children.length === 0 && !says(node, query)) {
    return null;
  }

  return { ...node, children };
};

export const only = (roots: readonly TraceNode[], query: string): TraceNode[] =>
  roots.flatMap((node) => {
    const held = kept(node, query);
    return held ? [held] : [];
  });

/**
 * The tree as rows to draw, deepest last. Anything held closed keeps its
 * children out of the list, and says how many it is holding.
 */
export const rowsOf = (
  roots: readonly TraceNode[],
  closed: ReadonlySet<string>,
  depth = 0,
): Row[] =>
  roots.flatMap((node) => {
    const row: Row = { node, depth, children: node.children.length };

    return closed.has(node.id)
      ? [row]
      : [row, ...rowsOf(node.children, closed, depth + 1)];
  });

/** Where a row's bar sits, as a share of the whole trace. */
export const laidOut = (
  node: TraceNode,
  trace: Trace,
): { left: number; width: number } => {
  const whole = Math.max(trace.ms, 1);
  const from = trace.startedAt ? at(trace.startedAt) : at(node.startedAt);

  return {
    left: ((at(node.startedAt) - from) / whole) * 100,
    width: (Math.max(node.ms, 0) / whole) * 100,
  };
};
