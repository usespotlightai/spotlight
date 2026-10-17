import type {
  AttachmentResponseDto,
  InboxMessageResponseDto,
  LatestChangeStackResponseDto,
  RunConversationResponseDto,
  StationResponseDto,
  TaskResponseDto,
  TaskRunResponseDto,
  TaskTraceResponseDto,
  TeamRunResponseDto,
  TeamTraceResponseDto,
  TeamTracesResponseDto,
  TraceNodeResponseDto,
  TraceStationResponseDto,
} from '@/lib/api';
import { perWorld, world } from '@/mocks/world';
import {
  pastTaskOf,
  pastTeamRuns,
  teamOfPastTask,
} from '@/mocks/world/past-work';
import { SAM } from '@/mocks/world/people';
import { egressEnforcementOf, errorsIn } from '@/mocks/world/run-network';
import {
  changeStacksOf,
  endOf,
  finished,
  messageOf,
  PREPARE_MS,
  PUBLISH_MS,
  runsOfAnyTask,
  storyOf,
  timedSteps,
} from '@/mocks/world/run-stories';
import { runStationOf } from '@/mocks/world/stations';
import { addedIn, removedIn } from '@/mocks/world/work-changes';
import type { NoteScript, RunStory } from '@/mocks/world/work-stories';

export { changeStacksOf };

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

type Located = {
  readonly teamId: string;
  readonly task: TaskResponseDto;
  readonly run: TaskRunResponseDto;
};

type Placed = {
  readonly line: { readonly id: string; readonly name: string };
  readonly station: StationResponseDto;
};

const tasksOf = (teamId: string): TaskResponseDto[] =>
  world().tasks[teamId] ?? [];

const runsOf = (taskId: string): TaskRunResponseDto[] => runsOfAnyTask(taskId);

export const findTask = (teamId: string, taskId: string) =>
  tasksOf(teamId).find((each) => each.id === taskId);

export const readableTask = (
  teamId: string,
  taskId: string,
): TaskResponseDto | undefined =>
  findTask(teamId, taskId) ??
  (teamOfPastTask(taskId) === teamId ? pastTaskOf(taskId) : undefined);

const pastTasksOf = (teamId: string): TaskResponseDto[] =>
  [...new Set(pastTeamRuns(teamId).map((run) => run.taskId ?? ''))].flatMap(
    (taskId) => pastTaskOf(taskId) ?? [],
  );

export const locateRun = (
  teamId: string,
  runId: string,
): Located | undefined => {
  for (const task of tasksOf(teamId)) {
    const run = (world().runs[task.id] ?? []).find((each) => each.id === runId);
    if (run) {
      return { teamId, task, run };
    }
  }

  const past = pastTeamRuns(teamId).find((each) => each.id === runId);
  const task = past?.taskId ? pastTaskOf(past.taskId) : undefined;
  const run = task
    ? runsOf(task.id).find((each) => each.id === runId)
    : undefined;

  return task && run ? { teamId, task, run } : undefined;
};

export const placeStation = (
  teamId: string,
  stationId: string,
): Placed | undefined => {
  for (const line of world().lines[teamId] ?? []) {
    const station = line.stations.find((each) => each.id === stationId);
    if (station) {
      return { line, station };
    }
  }

  return undefined;
};

export const runStationIn = (teamId: string, stationId: string) => {
  const line = (world().lines[teamId] ?? []).find((each) =>
    each.stations.some((station) => station.id === stationId),
  );

  return runStationOf(line?.stations ?? [], stationId);
};

const coreTeamRuns = (teamId: string): TeamRunResponseDto[] =>
  tasksOf(teamId).flatMap((task) =>
    (world().runs[task.id] ?? []).map((run) => ({
      ...run,
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
    })),
  );

export const teamRunsOf = (teamId: string): TeamRunResponseDto[] =>
  [...coreTeamRuns(teamId), ...pastTeamRuns(teamId)].sort(
    (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
  );

const conversationNotes = perWorld(
  (): Record<string, InboxMessageResponseDto[]> => ({}),
);

const noteOf = (
  located: Located,
  script: NoteScript,
  position: number,
): InboxMessageResponseDto => ({
  ...messageOf(located.run, script),
  position,
});

const briefingOf = (located: Located, story: RunStory): string => {
  const placed = located.run.station
    ? placeStation(located.teamId, located.run.station.id)
    : undefined;
  const name = placed?.station.name ?? 'Station';
  const role = [
    `You are the ${name} station of the ${placed?.line.name ?? ''} line.`,
    placed?.station.description ?? '',
  ]
    .join(' ')
    .trim();
  const task = [located.task.title, located.task.description]
    .filter(Boolean)
    .join('\n\n');

  return [
    `## ${name}\n\n${role}`,
    `## The task\n\n${task}`,
    ...(story.before ? [`## What came before\n\n${story.before}`] : []),
  ].join('\n\n');
};

export const conversationOf = (
  located: Located,
): RunConversationResponseDto => {
  const story = storyOf(located.run.id);
  const scripted = story.notes.map((script, position) =>
    noteOf(located, script, position),
  );
  const added = conversationNotes()[located.run.id] ?? [];

  return {
    runId: located.run.id,
    taskId: located.task.id,
    title: located.task.title,
    description: located.task.description,
    attachments: located.task.attachments,
    station: located.run.station,
    createdAt: located.run.startedAt,
    briefing: briefingOf(located, story),
    working: located.run.state === 'claimed',
    notes: [...scripted, ...added],
    spend: finished(located.run) ? story.spend : null,
  };
};

export const sayTo = (
  located: Located,
  body: string,
  attachments: AttachmentResponseDto[],
) => {
  const notes = conversationNotes();
  const before = conversationOf(located).notes.length;

  notes[located.run.id] = [
    ...(notes[located.run.id] ?? []),
    {
      ...noteOf(located, { kind: 'said', body }, before),
      at: new Date().toISOString(),
      attachments,
      author: SAM,
    },
  ];
};

const node = (
  over: Partial<Omit<TraceNodeResponseDto, 'startedAt'>> & {
    id: string;
    name: string;
    startedAt: number;
    ms: number;
  },
): TraceNodeResponseDto => ({
  kind: 'phase',
  tone: 'agent',
  cost: null,
  currency: null,
  step: null,
  span: null,
  connection: null,
  egressEnforcement: null,
  children: [],
  ...over,
  startedAt: new Date(over.startedAt).toISOString(),
});

const stepNodes = (
  run: TaskRunResponseDto,
  story: RunStory,
): TraceNodeResponseDto[] =>
  timedSteps(run, story).map((step, index) =>
    node({
      id: `${run.id}:${index + 1}`,
      kind: 'step',
      name: step.text,
      startedAt: Date.parse(step.startedAt),
      ms: step.ms,
      tone: step.status === 'failed' ? 'failed' : 'agent',
      step,
    }),
  );

const connectionNodes = (
  run: TaskRunResponseDto,
  from: number,
): TraceNodeResponseDto[] =>
  errorsIn(run.id).map((connection, index) =>
    node({
      id: `${run.id}:connection:${index}`,
      kind: 'connection',
      name: connection.host,
      tone: 'failed',
      startedAt: from + index * SECOND,
      ms: connection.count * 200,
      connection,
    }),
  );

const withConnections = (
  run: TaskRunResponseDto,
  steps: TraceNodeResponseDto[],
): TraceNodeResponseDto[] => {
  const [first, ...rest] = steps;

  if (!first) {
    return steps;
  }

  const startedAt = Date.parse(first.startedAt);

  return [
    {
      ...first,
      children: [...first.children, ...connectionNodes(run, startedAt)],
    },
    ...rest,
  ];
};

const runNode = (run: TaskRunResponseDto): TraceNodeResponseDto => {
  const story = storyOf(run.id);
  const from = Date.parse(run.startedAt);
  const to = endOf(run);
  const ms = Math.max(to - from, PREPARE_MS + PUBLISH_MS + SECOND);
  const done = finished(run);
  const turnMs = ms - PREPARE_MS - (done ? PUBLISH_MS : 0);
  const cost = story.spend?.cost ?? null;
  const currency = cost === null ? null : 'USD';

  return node({
    id: `run:${run.id}`,
    kind: 'run',
    name: run.station?.name ?? 'Run',
    startedAt: from,
    ms,
    tone: run.state === 'failed' ? 'failed' : 'agent',
    cost,
    currency,
    egressEnforcement: egressEnforcementOf(run.id),
    children: [
      node({
        id: `${run.id}:prepare`,
        name: 'Prepare',
        tone: 'overhead',
        startedAt: from,
        ms: PREPARE_MS,
      }),
      node({
        id: `${run.id}:turn`,
        name: `Turn · ${run.harness}`,
        startedAt: from + PREPARE_MS,
        ms: turnMs,
        cost,
        currency,
        children: withConnections(run, stepNodes(run, story)),
      }),
      ...(done
        ? [
            node({
              id: `${run.id}:publish`,
              name: 'Publish',
              tone: 'overhead',
              startedAt: to - PUBLISH_MS,
              ms: PUBLISH_MS,
            }),
          ]
        : []),
    ],
  });
};

const flattened = (nodes: readonly TraceNodeResponseDto[]) => {
  const all: TraceNodeResponseDto[] = [];
  const walk = (each: TraceNodeResponseDto) => {
    all.push(each);
    each.children.forEach(walk);
  };
  nodes.forEach(walk);
  return all;
};

const oldestFirst = (runs: readonly TaskRunResponseDto[]) =>
  [...runs].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));

export const taskTraceOf = (taskId: string): TaskTraceResponseDto => {
  const runs = oldestFirst(runsOf(taskId));
  const roots = runs.map(runNode);
  const nodes = flattened(roots);
  const first = runs[0];
  const last = runs.at(-1);

  return {
    startedAt: first?.startedAt ?? null,
    ms: first && last ? endOf(last) - Date.parse(first.startedAt) : 0,
    rows: nodes.length,
    faults: nodes.filter((each) => each.tone === 'failed').length,
    roots,
  };
};

const traceStation = (
  station: TaskRunResponseDto['station'],
): TraceStationResponseDto | null =>
  station
    ? {
        name: station.name,
        color: station.color,
        position: station.position,
        count: station.count,
      }
    : null;

const teamTraceOf = (task: TaskResponseDto): TeamTraceResponseDto | null => {
  const runs = oldestFirst(runsOf(task.id));
  const first = runs[0];
  const last = runs.at(-1);

  if (!first || !last) {
    return null;
  }

  const stories = runs.map((run) => storyOf(run.id));
  const trace = taskTraceOf(task.id);
  const costs = stories
    .map((story) => story.spend?.cost)
    .filter((cost): cost is number => cost !== undefined);
  const stations = runs
    .map((run) => traceStation(run.station))
    .filter((each): each is TraceStationResponseDto => each !== null)
    .filter(
      (each, at, all) =>
        all.findIndex((other) => other.name === each.name) === at,
    );

  return {
    taskId: task.id,
    title: task.title,
    station: traceStation(last.station),
    stations,
    harness: last.harness,
    state: last.state,
    startedAt: first.startedAt,
    runs: runs.length,
    input: task.description?.split('\n')[0] ?? null,
    output:
      stories
        .map((story) => story.output)
        .filter(Boolean)
        .at(-1) ?? null,
    ms: finished(last) ? trace.ms : null,
    steps: stories.reduce((sum, story) => sum + story.steps.length, 0),
    faults: trace.faults,
    cost: costs.length
      ? Math.round(costs.reduce((sum, cost) => sum + cost, 0) * 100) / 100
      : null,
    currency: costs.length ? 'USD' : null,
  };
};

const RANGE_HOURS: Record<TeamTracesResponseDto['range'], number> = {
  '30m': 0.5,
  '1h': 1,
  '6h': 6,
  '1d': 24,
  '3d': 72,
  '7d': 168,
  '14d': 336,
  '30d': 720,
  '90d': 2160,
};

const BUCKETS = 30;

export const teamTracesOf = (
  teamId: string,
  range: TeamTracesResponseDto['range'],
): TeamTracesResponseDto => {
  const to = Date.now();
  const from = to - RANGE_HOURS[range] * 60 * MINUTE;
  const tasks = [...tasksOf(teamId), ...pastTasksOf(teamId)];
  const traces = tasks
    .filter((task) => {
      const last = oldestFirst(runsOf(task.id)).at(-1);
      return last !== undefined && endOf(last) >= from;
    })
    .map(teamTraceOf)
    .filter((each): each is TeamTraceResponseDto => each !== null)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const runs = tasks.flatMap((task) => runsOf(task.id));
  const width = (to - from) / BUCKETS;

  return {
    range,
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    traces,
    volume: Array.from({ length: BUCKETS }, (_, at) => {
      const start = from + at * width;
      const inside = runs.filter((run) => {
        const started = Date.parse(run.startedAt);
        return started >= start && started < start + width;
      });

      return {
        from: new Date(start).toISOString(),
        to: new Date(start + width).toISOString(),
        count: inside.length,
        faults: inside.filter((run) => run.state === 'failed').length,
      };
    }),
  };
};

export const latestChangeStackOf = (
  taskId: string,
): LatestChangeStackResponseDto | null => {
  const run = oldestFirst(runsOf(taskId))
    .reverse()
    .find((each) => changeStacksOf(each.id).length > 0);

  if (!run) {
    return null;
  }

  const stacks = changeStacksOf(run.id);
  const only = stacks.length === 1 ? stacks[0] : undefined;

  return {
    runId: run.id,
    repository: only?.repository ?? null,
    state: stacks.some((each) => each.state === 'drafting')
      ? 'drafting'
      : 'ready',
    checkState: only?.check?.state ?? null,
    added: stacks.reduce((sum, each) => sum + addedIn(each), 0),
    removed: stacks.reduce((sum, each) => sum + removedIn(each), 0),
  };
};
