import type { TaskTraceResponseDto, TraceNodeResponseDto } from '@/lib/api';
import { repoRelative } from '@/lib/changes';

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

export const laidOut = (
  node: TraceNode,
  trace: Trace,
): { left: number; width: number } => {
  const whole = Math.max(trace.ms, 1);
  const from =
    trace.startedAt !== null && trace.startedAt !== ''
      ? at(trace.startedAt)
      : at(node.startedAt);

  return {
    left: ((at(node.startedAt) - from) / whole) * 100,
    width: (Math.max(node.ms, 0) / whole) * 100,
  };
};

const below = (node: TraceNode): TraceNode[] =>
  node.children.flatMap((child) => [child, ...below(child)]);

export const ancestorsOf = (
  roots: readonly TraceNode[],
  id: string,
): string[] | null => {
  for (const node of roots) {
    if (node.id === id) {
      return [];
    }

    const found = ancestorsOf(node.children, id);

    if (found) {
      return [node.id, ...found];
    }
  }

  return null;
};

export const stepNodeAt = (run: TraceNode, place: number): TraceNode | null =>
  below(run).find((node) => node.place === place) ?? null;

export const lastChangeTo = (run: TraceNode, path: string): TraceNode | null =>
  below(run)
    .filter((node) => {
      const changed = node.step?.change?.path;

      return (
        changed !== undefined &&
        changed !== null &&
        changed !== '' &&
        repoRelative(changed) === path
      );
    })
    .reduce<TraceNode | null>(
      (last, node) =>
        last && (last.place ?? -1) > (node.place ?? -1) ? last : node,
      null,
    );

const RUN = 'run:';

export const runIdOf = (node: TraceNode): string | null =>
  node.kind === 'run' && node.id.startsWith(RUN)
    ? node.id.slice(RUN.length)
    : null;

export const NAMES_PANE = {
  property: '--names-wanted',
  storageKey: 'spotlight.trace-names-width',
  min: 200,
  max: 640,
  initial: 320,
  label: 'Resize the names',
  limit: (shown: HTMLElement): number => {
    const room = shown.parentElement?.clientWidth ?? 0;
    return room * (room >= 448 ? 0.5 : 0.4);
  },
};

export const TICKS = [0, 0.25, 0.5, 0.75, 1];
