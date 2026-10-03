import type { QueryClient } from '@tanstack/react-query';
import { runScoreKeys } from '@/hooks/api/useRunScores';
import { taskKeys } from '@/hooks/api/useTasks';
import { taskTraceKeys } from '@/hooks/api/useTaskTrace';
import type {
  JournalStepResponseDto,
  TaskTraceResponseDto,
  TraceNodeResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import {
  seedWorkspace,
  TASK_ID,
  TASKS,
  TEAM_ID,
} from '@/stories/fixtures/board';
import {
  failRunScores,
  seedHiddenRunScores,
  seedNoRunScores,
  seedRunScores,
} from '@/stories/fixtures/run-scores';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const WHOLE = 38 * MINUTE;

const started = Date.now() - WHOLE - 5 * MINUTE;

const iso = (ms: number) => new Date(started + ms).toISOString();

const node = (
  over: Partial<TraceNodeResponseDto> & {
    id: string;
    name: string;
    from: number;
    ms: number;
  },
): TraceNodeResponseDto => {
  const { from, ...rest } = over;

  return {
    kind: 'step',
    startedAt: iso(from),
    tone: 'agent',
    cost: null,
    currency: null,
    step: null,
    span: null,
    children: [],
    ...rest,
  };
};

const step = (
  id: string,
  from: number,
  ms: number,
  over: Partial<JournalStepResponseDto> & { text: string },
): TraceNodeResponseDto =>
  node({
    id,
    name: over.text,
    from,
    ms,
    tone: over.status === 'failed' ? 'failed' : 'agent',
    step: {
      kind: 'tool',
      status: 'completed',
      tool: 'execute',
      detail: null,
      ms,
      startedAt: iso(from),
      locations: [],
      given: null,
      returned: null,
      change: null,
      ...over,
    },
  });

const run = (
  id: string,
  name: string,
  from: number,
  ms: number,
  cost: number,
  steps: TraceNodeResponseDto[],
): TraceNodeResponseDto =>
  node({
    id: `run:${id}`,
    name,
    kind: 'run',
    from,
    ms,
    cost,
    currency: 'USD',
    children: [
      node({
        id: `${id}:prepare`,
        name: 'Prepare',
        kind: 'phase',
        tone: 'overhead',
        from,
        ms: 20 * SECOND,
      }),
      node({
        id: `${id}:turn`,
        name: 'Turn · claude-code',
        kind: 'phase',
        from: from + 20 * SECOND,
        ms: ms - 30 * SECOND,
        cost,
        currency: 'USD',
        children: steps,
      }),
      node({
        id: `${id}:publish`,
        name: 'Publish',
        kind: 'phase',
        tone: 'overhead',
        from: from + ms - 10 * SECOND,
        ms: 10 * SECOND,
      }),
    ],
  });

const TRACE: TaskTraceResponseDto = {
  startedAt: iso(0),
  ms: WHOLE,
  rows: 17,
  faults: 1,
  roots: [
    run('run_retries_1', 'Triage', 0, 3 * MINUTE, 0.041, [
      step('run_retries_1:1', 25 * SECOND, 6 * SECOND, {
        kind: 'thought',
        status: null,
        tool: null,
        text: 'The worker redeploy may have left jobs behind in the retry queues.',
      }),
      step('run_retries_1:2', 35 * SECOND, 4 * SECOND, {
        text: 'queue-stats --all',
        detail: 'webhook-retries  1204\nbilling-retries    87',
      }),
      step('run_retries_1:3', 45 * SECOND, 2 * SECOND, {
        tool: 'read',
        text: 'services/worker/retry.ts',
      }),
    ]),
    run('run_retries_2', 'Implementation', 20 * MINUTE, 18 * MINUTE, 0.212, [
      step('run_retries_2:1', 20 * MINUTE + 30 * SECOND, 9 * MINUTE, {
        text: 'queue-drain webhook-retries',
        detail: 'replayed 1201\nfailed 3 (410 Gone)',
      }),
      step('run_retries_2:2', 30 * MINUTE, 40 * SECOND, {
        tool: 'edit',
        text: 'services/worker/retry.ts',
        change: {
          path: 'services/worker/retry.ts',
          before: 'if (response.status >= 400) {\n  return retry(job);\n}',
          after:
            'if (response.status === 410) {\n  return drop(job);\n}\nif (response.status >= 400) {\n  return retry(job);\n}',
        },
      }),
      step('run_retries_2:3', 31 * MINUTE, 3 * MINUTE, {
        text: 'npm test -- retry',
        status: 'failed',
        detail: '1 failing: drops a job the endpoint has gone from',
      }),
      step('run_retries_2:4', 35 * MINUTE, 2 * MINUTE, {
        text: 'npm test -- retry',
        detail: '12 passing',
      }),
      step('run_retries_2:5', 37 * MINUTE, 20 * SECOND, {
        kind: 'said',
        status: null,
        tool: null,
        text: 'Drained webhook-retries and stopped retrying endpoints that answer 410.',
      }),
    ]),
  ],
};

const seedTask = (client: QueryClient) => {
  seedWorkspace(client);
  client.setQueryData(taskKeys.forTeam(TEAM_ID), TASKS);
};

export const loadingTrace = seedTask;

const JUDGED_RUN = 'run_retries_2';

export const seedTrace = (client: QueryClient) => {
  seedTask(client);
  client.setQueryData(taskTraceKeys.forTask(TASK_ID), TRACE);
  seedNoRunScores(client, 'run_retries_1', TASK_ID);
  seedRunScores(client, JUDGED_RUN, TASK_ID);
};

export const seedJudgeHiddenTrace = (client: QueryClient) => {
  seedTrace(client);
  seedHiddenRunScores(client, JUDGED_RUN, TASK_ID);
};

export const failJudgeTrace = (client: QueryClient) => {
  seedTrace(client);
  client.removeQueries({ queryKey: runScoreKeys.forRun(JUDGED_RUN) });
  failRunScores(client, JUDGED_RUN);
};

export const emptyTrace = (client: QueryClient) => {
  seedTask(client);
  client.setQueryData(taskTraceKeys.forTask(TASK_ID), {
    startedAt: null,
    ms: 0,
    rows: 0,
    faults: 0,
    roots: [],
  } satisfies TaskTraceResponseDto);
};

export const failTrace = (client: QueryClient) => {
  seedTask(client);
  failQuery(client, taskTraceKeys.forTask(TASK_ID));
};
