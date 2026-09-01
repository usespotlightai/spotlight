import type {
  JournalStepResponseDto,
  RunJournalResponseDto,
  RunSpanResponseDto,
  TaskRunResponseDto,
} from '@/lib/api';

/**
 * What a row is drawn from. A phase is the run's own doing rather than the
 * agent's, which is why it is worth telling apart: a slow checkout and a slow
 * agent look the same in a list and nothing alike on a clock.
 */
export type NodeKind = 'run' | 'phase' | 'step' | 'span';

/** How a row reads: the agent's own work, the overhead around it, or a fault. */
export type Tone = 'agent' | 'overhead' | 'failed';

export interface TraceNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly name: string;
  readonly from: number;
  readonly to: number;
  readonly tone: Tone;
  // What the panel shows when the row is picked. A step and a span can both be
  // set: where they describe the same tool call, they are drawn as one row.
  readonly step: JournalStepResponseDto | null;
  readonly span: RunSpanResponseDto | null;
  readonly children: readonly TraceNode[];
}

export interface Trace {
  readonly from: number;
  readonly to: number;
  readonly roots: readonly TraceNode[];
  readonly rows: number;
  readonly errors: number;
}

export interface Row {
  readonly node: TraceNode;
  readonly depth: number;
  readonly children: number;
}

const at = (iso: string | null | undefined): number | null => {
  if (!iso) {
    return null;
  }
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
};

const failed = (step: JournalStepResponseDto): boolean =>
  step.status === 'failed';

const toneOf = (step: JournalStepResponseDto): Tone => {
  if (failed(step)) {
    return 'failed';
  }
  // A hook is the deployment's own code, and a plan is the agent talking about
  // work rather than doing it. Neither is the run getting on with it.
  return step.kind === 'hook' || step.kind === 'planned' ? 'overhead' : 'agent';
};

const named = (step: JournalStepResponseDto): string => {
  if (step.kind === 'said') {
    return 'Said';
  }
  if (step.kind === 'thought') {
    return 'Thought';
  }
  return step.text;
};

const nodeOfStep = (step: JournalStepResponseDto, id: string): TraceNode => {
  const from = at(step.startedAt) ?? 0;

  return {
    id,
    kind: 'step',
    name: named(step),
    from,
    to: from + Math.max(step.ms, 0),
    tone: toneOf(step),
    step,
    span: null,
    children: [],
  };
};

/**
 * A span keeps the harness's own name for itself, of the last part of it:
 * `claude_code.llm_request` reads as `llm_request`, which is what it is.
 */
const plainly = (name: string): string => name.split('.').slice(-1)[0] ?? name;

const nodeOfSpan = (
  span: RunSpanResponseDto,
  children: readonly TraceNode[],
  step: JournalStepResponseDto | null,
): TraceNode => {
  const from = at(span.startedAt) ?? 0;

  return {
    id: `span:${span.id}`,
    // What the agent called the tool says more than what the harness called
    // the span, where both are describing the same call.
    name: step ? step.text : plainly(span.name),
    kind: 'span',
    from,
    to: from + Math.max(span.ms, 0),
    tone: span.failed || (step && failed(step)) ? 'failed' : 'agent',
    step,
    span,
    children,
  };
};

/** Whether two stretches of time touch at all. */
const overlaps = (
  one: { from: number; to: number },
  other: { from: number; to: number },
): boolean => one.from <= other.to && other.from <= one.to;

const isToolSpan = (span: RunSpanResponseDto): boolean =>
  span.name.endsWith('.tool');

/**
 * A harness that reports on itself describes the same tool call the protocol
 * already described. Drawn twice they are two rows for one thing, so they are
 * paired: earliest span to the earliest tool step it overlaps, in time order.
 *
 * Paired on time rather than on name: what a harness calls its attributes is
 * its own business and changes between releases, while when a thing happened
 * is not open to interpretation.
 */
export const paired = (
  spans: readonly RunSpanResponseDto[],
  steps: readonly JournalStepResponseDto[],
): Map<string, JournalStepResponseDto> => {
  const tools = steps
    .filter((step) => step.kind === 'tool')
    .map((step) => {
      const from = at(step.startedAt) ?? 0;
      return { step, from, to: from + Math.max(step.ms, 0) };
    })
    .sort((one, other) => one.from - other.from);

  const taken = new Set<JournalStepResponseDto>();
  const pairs = new Map<string, JournalStepResponseDto>();

  const inOrder = spans
    .filter(isToolSpan)
    .map((span) => {
      const from = at(span.startedAt) ?? 0;
      return { span, from, to: from + Math.max(span.ms, 0) };
    })
    .sort((one, other) => one.from - other.from);

  for (const span of inOrder) {
    const found = tools.find(
      (tool) => !taken.has(tool.step) && overlaps(span, tool),
    );

    if (found) {
      taken.add(found.step);
      pairs.set(span.span.id, found.step);
    }
  }

  return pairs;
};

/** The spans of one run, hung off each other by the ids they carry. */
const nested = (
  spans: readonly RunSpanResponseDto[],
  pairs: Map<string, JournalStepResponseDto>,
): TraceNode[] => {
  const held = new Set(spans.map((span) => span.id));
  const under = new Map<string, RunSpanResponseDto[]>();
  const roots: RunSpanResponseDto[] = [];

  for (const span of spans) {
    // A parent outside this run's journal is no parent we can draw under.
    if (span.parentId && held.has(span.parentId)) {
      under.set(span.parentId, [...(under.get(span.parentId) ?? []), span]);
    } else {
      roots.push(span);
    }
  }

  const grow = (span: RunSpanResponseDto): TraceNode =>
    nodeOfSpan(
      span,
      (under.get(span.id) ?? [])
        .sort(
          (one, other) => (at(one.startedAt) ?? 0) - (at(other.startedAt) ?? 0),
        )
        .map(grow),
      pairs.get(span.id) ?? null,
    );

  return roots.map(grow);
};

interface Phase {
  readonly id: string;
  readonly name: string;
  readonly from: number;
  readonly to: number;
}

/**
 * Where a run turned from being prepared, to working, to publishing what came
 * of it. Only the stretches the journal can actually vouch for are drawn.
 */
const phasesOf = (
  journal: RunJournalResponseDto,
  runId: string,
  ends: number,
): Phase[] => {
  // A control plane older than this page says nothing about where a run
  // turned. Drawing no phases is the right answer then, not throwing.
  const marks = journal.marks ?? {};
  const opened = at(marks.startedAt);
  const ready = at(marks.readyAt);
  const from = at(marks.spokeFrom);
  const to = at(marks.spokeTo);
  const closed = at(marks.endedAt) ?? ends;

  const phases: Phase[] = [];

  if (opened !== null && ready !== null && ready > opened) {
    phases.push({
      id: `${runId}:prepare`,
      name: 'Prepare',
      from: opened,
      to: ready,
    });
  }
  if (from !== null && to !== null) {
    phases.push({ id: `${runId}:turn`, name: 'Turn', from, to });
  }
  if (to !== null && closed > to) {
    phases.push({
      id: `${runId}:publish`,
      name: 'Publish',
      from: to,
      to: closed,
    });
  }

  return phases;
};

const runName = (run: TaskRunResponseDto): string => {
  const station = run.station?.name ?? 'Run';
  const attempt = run.attempt > 1 ? ` · attempt ${run.attempt}` : '';
  return `${station} · ${run.harness}${attempt}`;
};

/**
 * One run, and everything that happened inside it. Steps and spans are laid
 * into whichever phase holds them, so what a phase cost is the sum of what is
 * drawn beneath it rather than a number of its own.
 */
const runNode = (
  run: TaskRunResponseDto,
  journal: RunJournalResponseDto | undefined,
): TraceNode => {
  const from = at(run.startedAt) ?? 0;
  const to = Math.max(at(run.updatedAt) ?? from, from);

  const steps = journal?.steps ?? [];
  const spans = journal?.spans ?? [];
  const pairs = paired(spans, steps);
  const merged = new Set(pairs.values());

  const held: TraceNode[] = [
    ...steps
      .filter((step) => !merged.has(step))
      .map((step, index) => nodeOfStep(step, `${run.id}:step:${index}`)),
    ...nested(spans, pairs),
  ].sort((one, other) => one.from - other.from);

  const phases = journal ? phasesOf(journal, run.id, to) : [];

  const inside = (node: TraceNode): Phase | undefined =>
    phases.find((phase) => node.from >= phase.from && node.from <= phase.to);

  const loose = held.filter((node) => !inside(node));
  const grouped: TraceNode[] = phases.map((phase) => ({
    id: phase.id,
    kind: 'phase',
    name: phase.name,
    from: phase.from,
    to: phase.to,
    tone: phase.name === 'Turn' ? 'agent' : 'overhead',
    step: null,
    span: null,
    children: held.filter((node) => inside(node)?.id === phase.id),
  }));

  return {
    id: `run:${run.id}`,
    kind: 'run',
    name: runName(run),
    from,
    to,
    tone: run.state === 'failed' ? 'failed' : 'agent',
    step: null,
    span: null,
    children: [...grouped, ...loose].sort(
      (one, other) => one.from - other.from,
    ),
  };
};

const counted = (
  nodes: readonly TraceNode[],
): { rows: number; errors: number } =>
  nodes.reduce(
    (all, node) => {
      const below = counted(node.children);
      return {
        rows: all.rows + 1 + below.rows,
        errors: all.errors + (node.tone === 'failed' ? 1 : 0) + below.errors,
      };
    },
    { rows: 0, errors: 0 },
  );

/**
 * Every run that worked one task, as one trace. The task is the trace and not
 * the run, because a task that came back from review is the interesting one.
 */
export const traceOf = (
  runs: readonly TaskRunResponseDto[],
  journals: readonly RunJournalResponseDto[],
): Trace => {
  const byRun = new Map(journals.map((each) => [each.runId, each]));

  const roots = [...runs]
    .map((run) => runNode(run, byRun.get(run.id)))
    .sort((one, other) => one.from - other.from);

  const { rows, errors } = counted(roots);

  return {
    from: Math.min(...roots.map((node) => node.from), Number.POSITIVE_INFINITY),
    to: Math.max(...roots.map((node) => node.to), Number.NEGATIVE_INFINITY),
    roots,
    rows,
    errors,
  };
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
  const whole = Math.max(trace.to - trace.from, 1);

  return {
    left: ((node.from - trace.from) / whole) * 100,
    width: (Math.max(node.to - node.from, 0) / whole) * 100,
  };
};
