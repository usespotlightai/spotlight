import type { ClaimsDraftRequest } from '@insights/application/ports/claims-drafter.port';
import { SESSION_WAITING } from '@insights/application/ports/session-outcomes';
import { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import { ClaimsRevisionRound } from '@insights/domain/value-objects/claims-revision-round.vo';
import { AssistClaimsDrafter } from '@insights/infrastructure/judging/assist-claims-drafter';
import {
  FakeAssistSessions,
  submitted,
} from '@insights/infrastructure/judging/assist-sessions.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const REQUEST: ClaimsDraftRequest = {
  workspaceId: 'workspace_1',
  round: ClaimsRevisionRound.of({
    revisionId: ClaimsRevisionId.of('revision_1'),
    attempt: 1,
  }),
  draftedFrom: RunId.of('run_0'),
  claims: ['It retries.', 'It adds a test.'],
  passThreshold: 0.5,
  cases: [
    {
      direction: 'judge-failed',
      claimResults: [true, false],
      reasons: [{ claim: 1, text: 'No test.' }],
      answers: [
        { claim: 1, answer: 'claim-wrong', note: 'The test is elsewhere.' },
      ],
      note: null,
      shouldHaveFailed: null,
    },
  ],
  maxCandidates: 2,
};

const drafting = (sessions: FakeAssistSessions) =>
  new AssistClaimsDrafter(sessions).drafted(REQUEST);

describe('drafting claims in an assist session', () => {
  it('orders a claims session with the claims and the cases as files, and keeps at most the drafts asked for', async () => {
    const sessions = new FakeAssistSessions(
      submitted({
        candidates: [
          { claims: ['It retries.'], why: 'The test claim misfires.' },
          { claims: ['It retries twice.'], why: 'Stricter.' },
          { claims: ['It retries once.'], why: 'Looser.' },
        ],
      }),
    );

    const drafted = await drafting(sessions);

    const [order] = sessions.orders;
    expect(order).toMatchObject({
      purpose: 'insights.claims',
      key: 'claims-revision:revision_1:1',
      basedOnRun: 'run_0',
    });
    expect(order?.briefing).toContain('.spotlight/assist/claims.json');
    expect(order?.briefing).toContain('.spotlight/assist/cases.json');
    expect(order?.briefing).toContain('at least 0.5');
    expect(order?.briefing).toContain('at most 2 different claim lists');
    expect(order?.briefing).toContain('spotlight submit');
    expect(order?.briefing).not.toContain('—');
    expect(JSON.parse(order?.files['claims.json'] ?? '')).toEqual([
      { index: 0, text: 'It retries.' },
      { index: 1, text: 'It adds a test.' },
    ]);
    expect(JSON.parse(order?.files['cases.json'] ?? '')).toEqual([
      {
        judge: 'failed',
        claims: [
          { index: 0, met: true },
          { index: 1, met: false },
        ],
        reasons: [{ claim: 1, text: 'No test.' }],
        answers: [
          { claim: 1, answer: 'claim-wrong', note: 'The test is elsewhere.' },
        ],
        note: null,
        should_have_failed: null,
      },
    ]);
    expect(drafted).toEqual({
      status: 'drafted',
      candidates: [['It retries.'], ['It retries twice.']],
    });
    expect(
      new AssistClaimsDrafter(sessions)
        .roundOf({
          workspaceId: 'workspace_1',
          purpose: 'insights.claims',
          key: order?.key ?? '',
        })
        ?.equals(REQUEST.round),
    ).toBe(true);
  });

  it('waits while the session has not submitted', async () => {
    await expect(drafting(new FakeAssistSessions())).resolves.toEqual(
      SESSION_WAITING,
    );
  });

  it.each(['no-harness', 'base-run-elsewhere'] as const)(
    'is unavailable when the session has nowhere to run: %s',
    async (reason) => {
      await expect(
        drafting(new FakeAssistSessions({ status: 'failed', reason })),
      ).resolves.toEqual({ status: 'unavailable' });
    },
  );

  it('fails, so the revision drafts again in a new round, when the session failed or its result does not fit', async () => {
    await expect(
      drafting(
        new FakeAssistSessions({ status: 'failed', reason: 'no-result' }),
      ),
    ).resolves.toEqual({ status: 'failed' });
    await expect(
      drafting(new FakeAssistSessions(submitted({ drafts: [] }))),
    ).resolves.toEqual({ status: 'failed' });
  });
});
