import type { QueryClient } from '@tanstack/react-query';
import { runScoreKeys } from '@/hooks/api/useRunScores';
import type { JudgeStandingResponseDto, RunScoresResponseDto } from '@/lib/api';
import { failQuery } from '@/stories/failQuery';

const TRUSTED: JudgeStandingResponseDto = {
  trusted: true,
  measure: 'kappa',
  agreement: 0.71,
  pairs: 24,
  trust: 0.6,
  hiddenBecause: null,
};

export const runScoresOf = (
  runId: string,
  taskId: string,
  over: Partial<RunScoresResponseDto> = {},
): RunScoresResponseDto => ({
  runId,
  taskId,
  stationId: 'station_implementation',
  kind: 'yes-no',
  claims: [],
  judged: true,
  standing: TRUSTED,
  grades: [],
  judge: {
    kind: 'yes-no',
    value: 0,
    marks: null,
    label: 'no',
    rubricVersion:
      '9c41e2d7a6b3f0851e2c4d6a8b0f1e3d5c7a9b1d3f5e7a9c1b3d5f7e9a1c3b5d',
    model: 'google/gemini-3.8-flash',
    at: new Date(Date.now() - 20 * 60_000).toISOString(),
    reasons: [
      {
        claim: null,
        text: 'It replayed the queue, but three jobs failed again and it asked instead of stopping the retries.',
        citations: [
          {
            kind: 'step',
            step: {
              index: 1,
              kind: 'tool',
              tool: 'execute',
              text: 'queue-drain webhook-retries',
            },
            hunk: null,
          },
        ],
      },
      {
        claim: null,
        text: 'The change retries a 410 Gone like any other failure.',
        citations: [
          {
            kind: 'hunk',
            step: null,
            hunk: {
              id: 'worker/services/retry.ts#1',
              path: 'worker/services/retry.ts',
              header: '@@ -1,3 +1,4 @@',
              lines: [
                ' export const retry = async (job: Job) => {',
                '-  await deliver(job);',
                '+  const answer = await deliver(job);',
                '+  if (!answer.ok) await later(job);',
                ' };',
              ],
            },
          },
          {
            kind: 'step',
            step: {
              index: 2,
              kind: 'tool',
              tool: 'read',
              text: 'services/worker/retry.ts',
            },
            hunk: null,
          },
        ],
      },
    ],
  },
  ...over,
});

const CLAIMS = [
  'Retries stop on a 410 Gone',
  'Every other failure is retried later',
  'The queue is drained',
];

export const claimsScoresOf = (
  runId: string,
  taskId: string,
): RunScoresResponseDto => {
  const scores = runScoresOf(runId, taskId);
  const [drained, gone] = scores.judge?.reasons ?? [];

  return {
    ...scores,
    kind: 'claims',
    claims: [CLAIMS[0] ?? null, CLAIMS[1] ?? null, null],
    judge: scores.judge && {
      ...scores.judge,
      kind: 'claims',
      value: 1 / 3,
      marks: [false, true, false],
      label: '33% of claims met',
      reasons: [
        ...(gone ? [{ ...gone, claim: 0 }] : []),
        ...(drained ? [{ ...drained, claim: 2 }] : []),
      ],
    },
  };
};

export const seedRunScores = (
  client: QueryClient,
  runId: string,
  taskId: string,
  over: Partial<RunScoresResponseDto> = {},
) => {
  client.setQueryData(
    runScoreKeys.forRun(runId),
    runScoresOf(runId, taskId, over),
  );
};

export const seedClaimsRunScores = (
  client: QueryClient,
  runId: string,
  taskId: string,
) => {
  client.setQueryData(
    runScoreKeys.forRun(runId),
    claimsScoresOf(runId, taskId),
  );
};

export const seedNoRunScores = (
  client: QueryClient,
  runId: string,
  taskId: string,
) => {
  client.setQueryData(
    runScoreKeys.forRun(runId),
    runScoresOf(runId, taskId, {
      judged: false,
      judge: null,
      standing: { ...TRUSTED, trusted: false, hiddenBecause: 'no-judge' },
    }),
  );
};

export const seedHiddenRunScores = (
  client: QueryClient,
  runId: string,
  taskId: string,
) =>
  seedRunScores(client, runId, taskId, {
    judge: null,
    standing: {
      ...TRUSTED,
      trusted: false,
      agreement: 0.38,
      hiddenBecause: 'below-trust',
    },
  });

export const failRunScores = (
  client: QueryClient,
  runId: string,
  error?: Error,
) => {
  failQuery(client, runScoreKeys.forRun(runId), error);
};
