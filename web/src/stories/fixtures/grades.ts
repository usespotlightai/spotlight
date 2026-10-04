import type { QueryClient } from '@tanstack/react-query';
import { journalKeys } from '@/hooks/api/useTaskJournal';
import type { JournalStepResponseDto, RunJournalResponseDto } from '@/lib/api';
import {
  failRunScores,
  seedClaimsRunScores,
  seedRunScores,
} from '@/stories/fixtures/run-scores';
import { NOT_ON_TEAM } from '@/stories/fixtures/team';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';
export const TASK_ID = 'task_retries';
export const RUN_ID = 'run_retries_2';
export const GRADE_ITEM_ID = 'aside_retries_grade';
export const TITLE = 'Drain the stuck retry queues';
const at = new Date(Date.now() - 30 * 60_000).toISOString();

const step = (
  over: Partial<JournalStepResponseDto> & { text: string },
): JournalStepResponseDto => ({
  kind: 'tool',
  status: 'completed',
  tool: null,
  detail: null,
  ms: 900,
  startedAt: at,
  locations: [],
  given: null,
  returned: null,
  change: null,
  ...over,
});

const JOURNAL: RunJournalResponseDto[] = [
  {
    runId: RUN_ID,
    attempt: 1,
    ms: 1_064_000,
    spans: [],
    marks: {
      startedAt: at,
      readyAt: null,
      spokeFrom: null,
      spokeTo: null,
      endedAt: at,
    },
    spent: null,
    steps: [
      step({ tool: 'execute', text: 'queue-drain webhook-retries' }),
      step({
        tool: 'edit',
        text: 'services/worker/retry.ts',
        change: {
          path: '/workspace/worker/services/retry.ts',
          before:
            'export const retry = async (job: Job) => {\n  await deliver(job);\n};\n',
          after:
            'export const retry = async (job: Job) => {\n  const answer = await deliver(job);\n  if (answer.status === 410) return;\n  if (!answer.ok) await later(job);\n};\n',
        },
      }),
      step({
        kind: 'said',
        status: null,
        text: 'Drained webhook-retries: 1,201 jobs replayed. Retries now stop on a 410 Gone, since those endpoints no longer exist.',
      }),
    ],
  },
];

export const seedGradeRun = (client: QueryClient) => {
  client.setQueryData(journalKeys.forTask(TASK_ID), JOURNAL);
  seedRunScores(client, RUN_ID, TASK_ID);
};

export const seedGradedRun = (client: QueryClient) => {
  client.setQueryData(journalKeys.forTask(TASK_ID), JOURNAL);
  seedRunScores(client, RUN_ID, TASK_ID, {
    grades: [
      {
        by: 'user_1',
        mine: true,
        kind: 'yes-no',
        value: 1,
        marks: null,
        label: 'yes',
        at,
      },
    ],
  });
};

export const seedGradeRunOnFive = (client: QueryClient) => {
  client.setQueryData(journalKeys.forTask(TASK_ID), JOURNAL);
  seedRunScores(client, RUN_ID, TASK_ID, {
    kind: 'number',
    rubricBody:
      'Score 5 where the bug is fixed with a small, tested change, and 1 where it is not fixed at all.',
  });
};

export const seedGradeRunOnClaims = (client: QueryClient) => {
  client.setQueryData(journalKeys.forTask(TASK_ID), JOURNAL);
  seedClaimsRunScores(client, RUN_ID, TASK_ID);
};

export const failGradeRun = (client: QueryClient) => {
  client.setQueryData(journalKeys.forTask(TASK_ID), JOURNAL);
  failRunScores(client, RUN_ID);
};

export const refuseGradeRun = (client: QueryClient) => {
  client.setQueryData(journalKeys.forTask(TASK_ID), JOURNAL);
  failRunScores(client, RUN_ID, NOT_ON_TEAM);
};
