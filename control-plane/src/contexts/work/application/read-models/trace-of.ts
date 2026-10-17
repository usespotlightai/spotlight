import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  EgressEnforcement,
  JournalStep,
  RunJournal,
  RunSpan,
} from '@work/application/contracts/run-journal.contract';
import type { ConnectionOfRun } from '@work/application/ports/run-connections.port';
import type { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import type { Money } from '@work/domain/value-objects/money.vo';
import type { RunConnection } from '@work/domain/value-objects/run-connection.vo';
import type { RunState } from '@work/domain/value-objects/run-state';
import type { StationName } from '@work/domain/value-objects/station-name.vo';
import { faulted } from '@work/domain/value-objects/step-status';

export type NodeKind = 'run' | 'phase' | 'step' | 'span' | 'connection';

export type Tone = 'agent' | 'overhead' | 'failed';

export interface WorkedRun {
  readonly id: RunId;
  readonly station: StationName | null;
  readonly harness: HarnessName;
  readonly state: RunState;
  readonly attempt: number;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly journal: RunJournal | null;
  readonly connections: readonly RunConnection[];
}

export const connectionsOf = (
  recorded: readonly ConnectionOfRun[],
  runId: string,
  attempt: number,
): RunConnection[] =>
  recorded
    .filter((each) => each.runId === runId && each.attempt === attempt)
    .map((each) => each.connection);

interface TracedConnection {
  readonly connection: RunConnection;
  readonly count: number;
}

export interface TraceNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly name: string;
  readonly from: Date;
  readonly to: Date;
  readonly tone: Tone;
  readonly step: JournalStep | null;
  readonly span: RunSpan | null;
  readonly cost: Money | null;
  readonly connection: TracedConnection | null;
  readonly egressEnforcement: EgressEnforcement | null;
  readonly children: readonly TraceNode[];
}

export interface Trace {
  readonly from: Date | null;
  readonly to: Date | null;
  readonly rows: number;
  readonly faults: number;
  readonly roots: readonly TraceNode[];
}

const at = (when: Date): number => when.getTime();

const ending = (from: Date, ms: number): Date =>
  new Date(at(from) + Math.max(ms, 0));

const toneOf = (step: JournalStep): Tone => {
  if (faulted(step.status)) {
    return 'failed';
  }

  return step.kind === 'hook' || step.kind === 'planned' ? 'overhead' : 'agent';
};

const named = (step: JournalStep): string => {
  if (step.kind === 'message') {
    return 'Message';
  }
  if (step.kind === 'thought') {
    return 'Thought';
  }
  return step.text;
};

const nodeOfStep = (step: JournalStep, id: string): TraceNode => ({
  id,
  kind: 'step',
  name: named(step),
  from: step.startedAt,
  to: ending(step.startedAt, step.ms),
  tone: toneOf(step),
  step,
  span: null,
  cost: null,
  connection: null,
  egressEnforcement: null,
  children: [],
});

const plainly = (name: string): string => name.split('.').slice(-1)[0] ?? name;

const nodeOfSpan = (
  span: RunSpan,
  children: readonly TraceNode[],
  step: JournalStep | null,
): TraceNode => ({
  id: `span:${span.id}`,
  kind: 'span',
  name: step ? step.text : plainly(span.name),
  from: span.startedAt,
  to: ending(span.startedAt, span.ms),
  tone: span.failed || (step && faulted(step.status)) ? 'failed' : 'agent',
  step,
  span,
  cost: null,
  connection: null,
  egressEnforcement: null,
  children,
});

interface Stretch {
  readonly from: number;
  readonly to: number;
}

const overlaps = (one: Stretch, other: Stretch): boolean =>
  one.from <= other.to && other.from <= one.to;

const isToolSpan = (span: RunSpan): boolean => span.name.endsWith('.tool');

const stretched = <T extends { startedAt: Date; ms: number }>(
  item: T,
): Stretch & { item: T } => ({
  item,
  from: at(item.startedAt),
  to: at(item.startedAt) + Math.max(item.ms, 0),
});

export const paired = (
  spans: readonly RunSpan[],
  steps: readonly JournalStep[],
): Map<string, JournalStep> => {
  const tools = steps
    .filter((step) => step.kind === 'tool')
    .map(stretched)
    .sort((one, other) => one.from - other.from);

  const taken = new Set<JournalStep>();
  const pairs = new Map<string, JournalStep>();

  for (const span of spans
    .filter(isToolSpan)
    .map(stretched)
    .sort((one, other) => one.from - other.from)) {
    const found = tools.find(
      (tool) => !taken.has(tool.item) && overlaps(span, tool),
    );

    if (found) {
      taken.add(found.item);
      pairs.set(span.item.id, found.item);
    }
  }

  return pairs;
};

const nested = (
  spans: readonly RunSpan[],
  pairs: ReadonlyMap<string, JournalStep>,
): TraceNode[] => {
  const ids = new Set(spans.map((span) => span.id));
  const under = new Map<string, RunSpan[]>();
  const roots: RunSpan[] = [];

  for (const span of spans) {
    if (span.parentId && ids.has(span.parentId)) {
      under.set(span.parentId, [...(under.get(span.parentId) ?? []), span]);
    } else {
      roots.push(span);
    }
  }

  const grow = (span: RunSpan): TraceNode =>
    nodeOfSpan(
      span,
      (under.get(span.id) ?? [])
        .sort((one, other) => at(one.startedAt) - at(other.startedAt))
        .map(grow),
      pairs.get(span.id) ?? null,
    );

  return roots.map(grow);
};

interface Phase {
  readonly id: string;
  readonly name: string;
  readonly from: Date;
  readonly to: Date;
  readonly worked: boolean;
}

const phasesOf = (run: WorkedRun, journal: RunJournal): Phase[] => {
  const marks = journal.marks;
  const closed = marks.endedAt ?? run.endedAt;
  const phases: Phase[] = [];

  if (marks.startedAt && marks.readyAt && marks.readyAt > marks.startedAt) {
    phases.push({
      id: `${run.id.value}:prepare`,
      name: 'Prepare',
      from: marks.startedAt,
      to: marks.readyAt,
      worked: false,
    });
  }

  if (marks.firstAgentUpdateAt && marks.lastAgentUpdateAt) {
    phases.push({
      id: `${run.id.value}:turn`,
      name: `Turn · ${run.harness.value}`,
      from: marks.firstAgentUpdateAt,
      to: marks.lastAgentUpdateAt,
      worked: true,
    });
  }

  if (marks.lastAgentUpdateAt && closed > marks.lastAgentUpdateAt) {
    phases.push({
      id: `${run.id.value}:publish`,
      name: 'Publish',
      from: marks.lastAgentUpdateAt,
      to: closed,
      worked: false,
    });
  }

  return phases;
};

const hostOf = (connection: RunConnection): string =>
  connection.port === 443
    ? connection.host
    : `${connection.host}:${connection.port}`;

interface Arriving {
  readonly id: string;
  readonly connection: RunConnection;
}

interface Group {
  readonly first: Arriving;
  readonly all: RunConnection[];
}

const nodeOfGroup = ({ first, all }: Group, until: Date): TraceNode => ({
  id: first.id,
  kind: 'connection',
  name: hostOf(first.connection),
  from: first.connection.at,
  to: new Date(
    Math.max(
      at(first.connection.at),
      Math.min(
        at(until),
        Math.max(...all.map((each) => at(ending(each.at, each.ms)))),
      ),
    ),
  ),
  tone: 'failed',
  step: null,
  span: null,
  cost: null,
  connection: { connection: first.connection, count: all.length },
  egressEnforcement: null,
  children: [],
});

const keyOf = (connection: RunConnection): string =>
  [
    connection.host,
    connection.port,
    connection.outcome,
    connection.status,
    connection.reason,
  ].join(' ');

const grouped = (arriving: readonly Arriving[], until: Date): TraceNode[] => {
  const groups = new Map<string, Group>();

  for (const each of arriving) {
    const key = keyOf(each.connection);
    const group = groups.get(key);

    if (group) {
      group.all.push(each.connection);
    } else {
      groups.set(key, { first: each, all: [each.connection] });
    }
  }

  return [...groups.values()].map((group) => nodeOfGroup(group, until));
};

const covers = (node: TraceNode, when: Date): boolean =>
  node.kind !== 'connection' && node.from <= when && when <= node.to;

const withConnections = (
  node: TraceNode,
  arriving: readonly Arriving[],
): TraceNode => {
  if (arriving.length === 0) {
    return node;
  }

  const below = new Map<TraceNode, Arriving[]>();
  const own: Arriving[] = [];

  for (const each of arriving) {
    const child = [...node.children]
      .reverse()
      .find((found) => covers(found, each.connection.at));

    if (child) {
      below.set(child, [...(below.get(child) ?? []), each]);
    } else {
      own.push(each);
    }
  }

  return {
    ...node,
    children: [
      ...node.children.map((child) =>
        withConnections(child, below.get(child) ?? []),
      ),
      ...grouped(own, node.to),
    ].sort((one, other) => at(one.from) - at(other.from)),
  };
};

const runName = (run: WorkedRun): string =>
  `${run.station?.value ?? 'Run'}${run.attempt > 1 ? ` · attempt ${run.attempt}` : ''}`;

const runNode = (run: WorkedRun): TraceNode => {
  const journal = run.journal;
  const steps = journal?.steps ?? [];
  const spans = journal?.spans ?? [];
  const pairs = paired(spans, steps);
  const merged = new Set(pairs.values());

  const nodes: TraceNode[] = [
    ...steps
      .filter((step) => !merged.has(step))
      .map((step, index) => nodeOfStep(step, `${run.id.value}:step:${index}`)),
    ...nested(spans, pairs),
  ].sort((one, other) => at(one.from) - at(other.from));

  const phases = journal ? phasesOf(run, journal) : [];

  const inside = (node: TraceNode): Phase | undefined =>
    phases.find((phase) => node.from >= phase.from && node.from <= phase.to);

  const phased: TraceNode[] = phases.map((phase) => ({
    id: phase.id,
    kind: 'phase',
    name: phase.name,
    from: phase.from,
    to: phase.to,
    tone: phase.worked ? 'agent' : 'overhead',
    step: null,
    span: null,
    cost: null,
    connection: null,
    egressEnforcement: null,
    children: nodes.filter((node) => inside(node)?.id === phase.id),
  }));

  const loose = nodes.filter((node) => !inside(node));

  const arriving = run.connections
    .filter((each) => each.isError)
    .sort((one, other) => at(one.at) - at(other.at))
    .map((connection, index) => ({
      id: `${run.id.value}:connection:${index}`,
      connection,
    }));

  return withConnections(
    {
      id: `run:${run.id.value}`,
      kind: 'run',
      name: runName(run),
      from: run.startedAt,
      to: run.endedAt > run.startedAt ? run.endedAt : run.startedAt,
      tone: run.state === 'failed' ? 'failed' : 'agent',
      step: null,
      span: null,
      cost: journal?.spent?.cost ?? null,
      connection: null,
      egressEnforcement: journal?.egressEnforcement ?? null,
      children: [...phased, ...loose].sort(
        (one, other) => at(one.from) - at(other.from),
      ),
    },
    arriving,
  );
};

const counted = (
  nodes: readonly TraceNode[],
): { rows: number; faults: number } =>
  nodes.reduce(
    (all, node) => {
      const below = counted(node.children);

      return {
        rows: all.rows + 1 + below.rows,
        faults:
          all.faults +
          (node.tone === 'failed' && node.kind !== 'connection' ? 1 : 0) +
          below.faults,
      };
    },
    { rows: 0, faults: 0 },
  );

export const traceOf = (runs: readonly WorkedRun[]): Trace => {
  const roots = [...runs]
    .map(runNode)
    .sort((one, other) => at(one.from) - at(other.from));

  const { rows, faults } = counted(roots);

  return {
    from: roots[0]?.from ?? null,
    to: roots.reduce<Date | null>(
      (last, node) => (last && last > node.to ? last : node.to),
      null,
    ),
    rows,
    faults,
    roots,
  };
};
