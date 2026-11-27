import type {
  JournalStep,
  RunJournal,
  RunSpan,
} from '@runs/application/contracts/run-journal.contract';
import type {
  Category,
  RunToTrace,
  Trace,
  TraceNode,
} from '@runs/application/contracts/run-trace.contract';
import type {
  ConnectionOfRun,
  RunConnectionContract,
} from '@runs/application/ports/run-connections.port';
import { stepNumber } from '@runs/domain/services/journal-step-numbers';
import { faulted } from '@runs/domain/value-objects/step-status';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

type RunConnection = RunConnectionContract;

export interface TracedRun {
  readonly id: RunId;
  readonly label: string | null;
  readonly harness: string;
  readonly failed: boolean;
  readonly attempt: number;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly journals: readonly RunJournal[];
  readonly connections: readonly RunConnection[];
}

export const tracedRunsOf = (
  runs: readonly RunToTrace[],
  journals: readonly RunJournal[],
  errors: readonly ConnectionOfRun[],
): TracedRun[] => {
  return runs.map((run) => ({
    id: RunId.of(run.id),
    label: run.label === '' ? null : run.label,
    harness: run.harness,
    failed: run.failed,
    attempt: run.attempt,
    startedAt: run.startedAt,
    endedAt: run.endedAt ?? run.updatedAt,
    journals: journals
      .filter((journal) => journal.runId === run.id)
      .sort((one, other) => one.attempt - other.attempt),
    connections: errors
      .filter((each) => each.runId === run.id)
      .map((each) => each.connection),
  }));
};

const at = (when: Date): number => when.getTime();

const ending = (from: Date, ms: number): Date =>
  new Date(at(from) + Math.max(ms, 0));

const OVERHEAD_KINDS: ReadonlySet<JournalStep['kind']> = new Set([
  'hook',
  'planned',
  'waited',
  'reminded',
]);

const categoryOf = (step: JournalStep): Category => {
  if (faulted(step.status)) {
    return 'failed';
  }

  return OVERHEAD_KINDS.has(step.kind) ? 'overhead' : 'agent';
};

const named = (step: JournalStep): string => {
  if (step.kind === 'message') {
    return 'Message';
  }
  if (step.kind === 'thought') {
    return 'Thought';
  }
  if (step.kind === 'turn') {
    return step.text || 'Continued on its own';
  }
  return step.text;
};

const nodeOfStep = (
  step: JournalStep,
  id: string,
  place: number,
): TraceNode => ({
  id,
  kind: 'step',
  name: named(step),
  from: step.startedAt,
  to: ending(step.startedAt, step.ms),
  category: categoryOf(step),
  step,
  place,
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
  place: number | null,
): TraceNode => ({
  id: `span:${span.id}`,
  kind: 'span',
  name: step ? step.text : plainly(span.name),
  from: span.startedAt,
  to: ending(span.startedAt, span.ms),
  category: span.failed || (step && faulted(step.status)) ? 'failed' : 'agent',
  step,
  place,
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
  places: ReadonlyMap<JournalStep, number>,
): TraceNode[] => {
  const ids = new Set(spans.map((span) => span.id));
  const under = new Map<string, RunSpan[]>();
  const roots: RunSpan[] = [];

  for (const span of spans) {
    if (nonEmpty(span.parentId) && ids.has(span.parentId)) {
      under.set(span.parentId, [...(under.get(span.parentId) ?? []), span]);
    } else {
      roots.push(span);
    }
  }

  const grow = (span: RunSpan): TraceNode => {
    const step = pairs.get(span.id) ?? null;

    return nodeOfSpan(
      span,
      (under.get(span.id) ?? [])
        .sort((one, other) => at(one.startedAt) - at(other.startedAt))
        .map(grow),
      step,
      step ? (places.get(step) ?? null) : null,
    );
  };

  return roots.map(grow);
};

interface Phase {
  readonly id: string;
  readonly name: string;
  readonly from: Date;
  readonly to: Date;
  readonly isAgent: boolean;
}

const attemptIdOf = (run: TracedRun, journal: RunJournal): string =>
  journal.attempt > 1
    ? `${run.id.value}:attempt-${journal.attempt}`
    : run.id.value;

const attemptNameOf = (name: string, journal: RunJournal): string =>
  journal.attempt > 1 ? `${name} · attempt ${journal.attempt}` : name;

const phasesOf = (run: TracedRun, journal: RunJournal): Phase[] => {
  const marks = journal.marks;
  const closed = marks.endedAt ?? run.endedAt;
  const id = attemptIdOf(run, journal);
  const phases: Phase[] = [];

  if (marks.startedAt && marks.readyAt && marks.readyAt > marks.startedAt) {
    phases.push({
      id: `${id}:prepare`,
      name: attemptNameOf('Prepare', journal),
      from: marks.startedAt,
      to: marks.readyAt,
      isAgent: false,
    });
  }

  if (marks.firstAgentUpdateAt && marks.lastAgentUpdateAt) {
    phases.push({
      id: `${id}:turn`,
      name: attemptNameOf(`Turn · ${run.harness}`, journal),
      from: marks.firstAgentUpdateAt,
      to: marks.lastAgentUpdateAt,
      isAgent: true,
    });
  }

  if (marks.lastAgentUpdateAt && closed > marks.lastAgentUpdateAt) {
    phases.push({
      id: `${id}:publish`,
      name: attemptNameOf('Publish', journal),
      from: marks.lastAgentUpdateAt,
      to: closed,
      isAgent: false,
    });
  }

  return phases;
};

const hostOf = (connection: RunConnection): string =>
  connection.port === 443
    ? connection.host
    : `${connection.host}:${connection.port}`;

interface ArrivingConnection {
  readonly id: string;
  readonly connection: RunConnection;
}

interface Group {
  readonly first: ArrivingConnection;
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
  category: 'failed',
  step: null,
  place: null,
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

const grouped = (
  arriving: readonly ArrivingConnection[],
  until: Date,
): TraceNode[] => {
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
  arriving: readonly ArrivingConnection[],
): TraceNode => {
  if (arriving.length === 0) {
    return node;
  }

  const below = new Map<TraceNode, ArrivingConnection[]>();
  const own: ArrivingConnection[] = [];

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

const runName = (run: TracedRun): string =>
  `${run.label ?? 'Run'}${run.attempt > 1 ? ` · attempt ${run.attempt}` : ''}`;

const attemptNodesOf = (run: TracedRun, journal: RunJournal): TraceNode[] => {
  const pairs = paired(journal.spans, journal.steps);
  const merged = new Set(pairs.values());
  const numbered = journal.steps.map((step, position) => ({
    step,
    place: stepNumber(journal.attempt, position),
  }));
  const places = new Map(
    numbered.map(({ step, place }) => [step, place] as const),
  );
  const id = attemptIdOf(run, journal);

  const nodes: TraceNode[] = [
    ...numbered
      .filter(({ step }) => !merged.has(step))
      .map(({ step, place }, index) =>
        nodeOfStep(step, `${id}:step:${index}`, place),
      ),
    ...nested(journal.spans, pairs, places),
  ].sort((one, other) => at(one.from) - at(other.from));

  const phases = phasesOf(run, journal);

  const inside = (node: TraceNode): Phase | undefined =>
    phases.find((phase) => node.from >= phase.from && node.from <= phase.to);

  const phased: TraceNode[] = phases.map((phase) => ({
    id: phase.id,
    kind: 'phase',
    name: phase.name,
    from: phase.from,
    to: phase.to,
    category: phase.isAgent ? 'agent' : 'overhead',
    step: null,
    place: null,
    span: null,
    cost: null,
    connection: null,
    egressEnforcement: null,
    children: nodes.filter((node) => inside(node)?.id === phase.id),
  }));

  return [...phased, ...nodes.filter((node) => !inside(node))];
};

const runNode = (run: TracedRun): TraceNode => {
  const children = run.journals
    .flatMap((journal) => attemptNodesOf(run, journal))
    .sort((one, other) => at(one.from) - at(other.from));
  const from = new Date(
    Math.min(at(run.startedAt), ...children.map((child) => at(child.from))),
  );

  const arriving = run.connections
    .filter((each) => each.error !== null)
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
      from,
      to: new Date(Math.max(run.endedAt.getTime(), from.getTime())),
      category: run.failed ? 'failed' : 'agent',
      step: null,
      place: null,
      span: null,
      cost: run.journals[run.journals.length - 1]?.spent?.cost ?? null,
      connection: null,
      egressEnforcement:
        run.journals[run.journals.length - 1]?.egressEnforcement ?? null,
      children,
    },
    arriving,
  );
};

const counted = (
  nodes: readonly TraceNode[],
): { rows: number; errors: number } =>
  nodes.reduce(
    (all, node) => {
      const below = counted(node.children);

      return {
        rows: all.rows + 1 + below.rows,
        errors:
          all.errors +
          (node.category === 'failed' && node.kind !== 'connection' ? 1 : 0) +
          below.errors,
      };
    },
    { rows: 0, errors: 0 },
  );

export const traceOf = (runs: readonly TracedRun[]): Trace => {
  const roots = [...runs]
    .map(runNode)
    .sort((one, other) => at(one.from) - at(other.from));

  const { rows, errors } = counted(roots);

  return {
    from: roots[0]?.from ?? null,
    to: roots.reduce<Date | null>(
      (last, node) => (last && last > node.to ? last : node.to),
      null,
    ),
    rows,
    errors,
    roots,
  };
};
