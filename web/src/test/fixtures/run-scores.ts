import type { JudgeCalibrationResponseDto } from '@/lib/api';
import type { RunScores } from '@/lib/judge';

export const CLAIMS = [
  'Retries stop on a 410 Gone',
  'Every other failure is retried later',
  'The queue is drained',
];

const TRUSTED: JudgeCalibrationResponseDto = {
  qualified: true,
  agreement: 0.71,
  reading: 'substantial',
  pairs: 24,
  minPairs: 10,
  minAgreement: 0.6,
  hiddenReason: null,
  failing: false,
};

export const runScoresOf = (
  runId: string,
  taskId: string,
  over: Partial<RunScores> = {},
): RunScores => ({
  runId,
  taskId,
  stationId: 'station_implementation',
  judged: true,
  calibration: TRUSTED,
  labelFrom: null,
  peoplePass: null,
  personVerdict: null,
  implicitFrom: null,
  takesVerdict: true,
  agrees: null,
  judge: {
    claims: CLAIMS,
    value: 1 / 3,
    claimResults: [false, true, false],
    passes: false,
    rubricVersion:
      '9c41e2d7a6b3f0851e2c4d6a8b0f1e3d5c7a9b1d3f5e7a9c1b3d5f7e9a1c3b5d',
    model: 'google/gemini-3.8-flash',
    at: new Date(Date.now() - 20 * 60_000).toISOString(),
    reasons: [
      {
        claim: 2,
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
        claim: 1,
        text: 'Other failures go to the retry queue.',
        citations: [],
      },
      {
        claim: 0,
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
