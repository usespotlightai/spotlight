import type { JudgeDisagreement } from '@/lib/judge-disagreement';
import { CLAIMS } from '@/test/fixtures/run-scores';

export const failedDisagreementOf = (
  over: Partial<JudgeDisagreement> = {},
): JudgeDisagreement => ({
  id: 'disagreement_1',
  runId: 'run_1',
  taskId: 'task_1',
  lineId: 'line_1',
  stationId: 'station_implementation',
  rubricVersion:
    '9c41e2d7a6b3f0851e2c4d6a8b0f1e3d5c7a9b1d3f5e7a9c1b3d5f7e9a1c3b5d',
  direction: 'judge-failed',
  labelFrom: 'accepted',
  openedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  claims: [
    {
      index: 0,
      text: CLAIMS[0] ?? '',
      judgeMet: false,
      reasons: [
        {
          text: 'The change retries a 410 Gone like any other failure.',
          citations: [
            { kind: 'hunk', step: null, hunk: 'worker/services/retry.ts#1' },
            { kind: 'step', step: 2, hunk: null },
          ],
        },
      ],
    },
    {
      index: 1,
      text: CLAIMS[1] ?? '',
      judgeMet: true,
      reasons: [
        { text: 'Other failures go to the retry queue.', citations: [] },
      ],
    },
    {
      index: 2,
      text: CLAIMS[2] ?? '',
      judgeMet: false,
      reasons: [
        {
          text: 'It replayed the queue, but three jobs failed again and it asked instead of stopping the retries.',
          citations: [{ kind: 'step', step: 1, hunk: null }],
        },
      ],
    },
  ],
  disputedClaims: [0, 2],
  state: 'open',
  askedOf: 'user_sam',
  answers: [],
  notMet: null,
  withdrawnAt: null,
  withdrawnBecause: null,
  ...over,
});

export const passedDisagreementOf = (
  over: Partial<JudgeDisagreement> = {},
): JudgeDisagreement =>
  failedDisagreementOf({
    direction: 'judge-passed',
    labelFrom: 'sent-back',
    claims: failedDisagreementOf().claims.map((claim) => ({
      ...claim,
      judgeMet: true,
    })),
    disputedClaims: [],
    ...over,
  });
