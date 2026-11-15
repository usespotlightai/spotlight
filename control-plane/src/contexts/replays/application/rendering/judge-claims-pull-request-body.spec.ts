import { JudgeClaimsPullRequestBody } from '@replays/application/rendering/judge-claims-pull-request-body';
import { describe, expect, it } from 'vitest';

const FACTS = {
  lineKey: 'delivery',
  stationKey: 'implement',
  trigger: 'claim-wrong' as const,
  claimsBefore: ['It retries the upload.', 'It adds a test file.'],
  claimsAfter: ['It retries the upload.', 'It adds or changes a test.'],
  searched: { before: 0.2, after: 0.6, runs: 28 },
  heldOut: { before: 0.1, after: 0.5, runs: 12 },
  disagreementRuns: [
    {
      runId: 'run_1',
      taskId: 'task_1',
      direction: 'judge-failed' as const,
      claimsWrong: [1],
      notes: [
        { claim: 0, text: 'The judge read the retry right.' },
        { claim: 1, text: 'The test sits in another file.' },
      ],
    },
    {
      runId: 'run_2',
      taskId: 'task_2',
      direction: 'judge-passed' as const,
      claimsWrong: [],
      notes: [{ claim: null, text: 'It broke the login page.' }],
    },
  ],
};

describe('JudgeClaimsPullRequestBody', () => {
  it('puts each note by the claim it explains', () => {
    const body = JudgeClaimsPullRequestBody.of(FACTS);

    expect(body).toContain(
      '- Run run_1 of task task_1. The judge failed the run and a person passed it. Wrong claims: "It adds a test file.". Note on "It retries the upload.": "The judge read the retry right." Note on "It adds a test file.": "The test sits in another file."',
    );
    expect(body).toContain(
      '- Run run_2 of task task_2. The judge passed the run and a person failed it. Note: "It broke the login page."',
    );
  });
});
