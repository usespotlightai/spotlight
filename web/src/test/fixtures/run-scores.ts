import type {
  JudgeCalibrationResponseDto,
  RunScoresResponseDto,
} from '@/lib/api';

export const RUBRIC =
  'Pass a run that fixes the reported bug without widening the change. Fail it where tests were skipped or the diff touches unrelated files.';

const TRUSTED: JudgeCalibrationResponseDto = {
  qualified: true,
  measure: 'kappa',
  agreement: 0.71,
  pairs: 24,
  minAgreement: 0.6,
  hiddenReason: null,
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
  rubricBody: RUBRIC,
  claims: [],
  judged: true,
  calibration: TRUSTED,
  grades: [],
  judge: {
    kind: 'yes-no',
    value: 0,
    claimResults: null,
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
    claims: CLAIMS,
    judge: scores.judge && {
      ...scores.judge,
      kind: 'claims',
      value: 1 / 3,
      claimResults: [false, true, false],
      label: '33% of claims met',
      reasons: [
        ...(gone ? [{ ...gone, claim: 0 }] : []),
        ...(drained ? [{ ...drained, claim: 2 }] : []),
      ],
    },
  };
};
