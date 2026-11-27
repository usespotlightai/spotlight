import { JudgeDisagreement } from '@insights/domain/aggregates/judge-disagreement.aggregate';
import { ClaimNotInDisputeError } from '@insights/domain/exceptions/claim-not-in-dispute.error';
import { DisagreementClaimAnsweredError } from '@insights/domain/exceptions/disagreement-claim-answered.error';
import { InvalidJudgeDisagreementError } from '@insights/domain/exceptions/invalid-judge-disagreement.error';
import { JudgeDisagreementAnsweredError } from '@insights/domain/exceptions/judge-disagreement-answered.error';
import { JudgeDisagreementNotAskedOfYouError } from '@insights/domain/exceptions/judge-disagreement-not-asked-of-you.error';
import { JudgeDisagreementWithdrawnError } from '@insights/domain/exceptions/judge-disagreement-withdrawn.error';
import { ClaimAnswer } from '@insights/domain/value-objects/claim-answer.vo';
import { NotMetAnswer } from '@insights/domain/value-objects/not-met-answer.vo';
import { openDisagreement } from '@insights/judge-repair.fake-spec';
import { NEXT_RUBRIC_VERSION } from '@insights/judging.fake-spec';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-02T10:00:00.000Z');

const ADA = UserId.of('user_ada');

const GRACE = UserId.of('user_grace');

const LATER = new Date('2026-10-02T11:00:00.000Z');

const claimAnswer = (
  claim: number,
  by: UserId = ADA,
  now: Date = NOW,
  note: string | null = null,
) => ({
  claim,
  answer: 'claim-wrong' as const,
  note,
  by,
  now,
});

const notMet = (
  shouldHaveFailed: number | null,
  note: string | null,
  by: UserId = ADA,
) => ({
  shouldHaveFailed,
  note,
  by,
  now: NOW,
});

const fieldsOf = (disagreement: JudgeDisagreement) => ({
  id: disagreement.id,
  runId: disagreement.runId,
  workspaceId: disagreement.workspaceId,
  location: disagreement.location,
  verdict: disagreement.verdict,
  labelFrom: disagreement.labelFrom,
  askedOf: disagreement.askedOf,
  openedAt: disagreement.openedAt,
  claimAnswers: disagreement.claimAnswers,
  notMet: disagreement.notMet,
  answeredAt: disagreement.answeredAt,
  withdrawnAt: disagreement.withdrawnAt,
  withdrawnBecause: disagreement.withdrawnBecause,
  version: disagreement.version,
});

describe('JudgeDisagreement', () => {
  it('opens where the judge failed a run that people passed', () => {
    const disagreement = openDisagreement('run_1', {
      claimResults: [true, false, false],
    });

    expect(disagreement.direction).toBe('judge-failed');
    expect(disagreement.disputedClaims).toEqual([1, 2]);
    expect(disagreement.pullEvents().map((each) => each.kind)).toEqual([
      'judge-disagreement.opened',
    ]);
  });

  it('asks the person whose action gave the label', () => {
    const disagreement = openDisagreement('run_1', { askedOf: GRACE });

    expect(disagreement.askedOf).toEqual(GRACE);
  });

  it('asks the team only for a merged pull request', () => {
    const fields = fieldsOf(openDisagreement('run_1', { askedOf: ADA }));
    const merged = fieldsOf(openDisagreement('run_2', { labelFrom: 'merged' }));
    const opening = (
      labelFrom: 'accepted' | 'merged',
      askedOf: UserId | null,
    ) =>
      JudgeDisagreement.open({
        ...fields,
        judgePasses: false,
        labelFrom,
        askedOf,
        now: NOW,
      });

    expect(() => opening('accepted', null)).toThrow(
      InvalidJudgeDisagreementError,
    );
    expect(() => opening('merged', ADA)).toThrow(InvalidJudgeDisagreementError);
    expect(() =>
      JudgeDisagreement.rehydrate({ ...fields, askedOf: null }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      JudgeDisagreement.rehydrate({ ...merged, askedOf: ADA }),
    ).toThrow(InconsistentStateError);
  });

  it('opens where the judge passed a run that people failed', () => {
    expect(
      openDisagreement('run_1', { claimResults: [true, true, true] }).direction,
    ).toBe('judge-passed');
  });

  it('opens only where the judge and the label disagree', () => {
    expect(() =>
      openDisagreement('run_1', {
        claimResults: [true, true, true],
        labelFrom: 'accepted',
      }),
    ).toThrow(InvalidJudgeDisagreementError);
  });

  it('keeps one judge result for each claim', () => {
    expect(() => openDisagreement('run_1', { claimResults: [false] })).toThrow(
      InvalidJudgeDisagreementError,
    );
  });

  it('takes an answer for one claim in dispute, with its own note, who and when', () => {
    const disagreement = openDisagreement('run_1');
    disagreement.pullEvents();

    const answered = disagreement.answerClaim(
      claimAnswer(2, ADA, NOW, '  The test is in another file.  '),
    );

    expect(answered.claimAnswers).toEqual([
      ClaimAnswer.of({
        claim: 2,
        answer: 'claim-wrong',
        note: 'The test is in another file.',
        by: ADA,
        at: NOW,
      }),
    ]);
    expect(answered.claimsWrong).toEqual([2]);
    expect(answered.answeredAt).toBeNull();
    expect(answered.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'judge-disagreement.claim-answered',
        claim: 2,
      }),
    ]);
  });

  it('stays open after the first of two answers and is answered after the second', () => {
    const first = openDisagreement('run_1', {
      labelFrom: 'merged',
    }).answerClaim(claimAnswer(1));
    first.pullEvents();
    const second = first.answerClaim(claimAnswer(2, GRACE, LATER));

    expect(first.state).toBe('open');
    expect(second.state).toBe('answered');
    expect(second.answeredAt).toEqual(LATER);
    expect(second.claimAnswers.map((each) => [each.claim, each.by])).toEqual([
      [1, ADA],
      [2, GRACE],
    ]);
    expect(second.pullEvents().map((each) => each.kind)).toEqual([
      'judge-disagreement.claim-answered',
      'judge-disagreement.answered',
    ]);
  });

  it('refuses a claim that is not in dispute', () => {
    expect(() => openDisagreement('run_1').answerClaim(claimAnswer(0))).toThrow(
      ClaimNotInDisputeError,
    );
    expect(() =>
      openDisagreement('run_2', {
        claimResults: [true, true, true],
      }).answerClaim(claimAnswer(1)),
    ).toThrow(ClaimNotInDisputeError);
  });

  it('takes one answer for each claim', () => {
    const answered = openDisagreement('run_1').answerClaim(claimAnswer(1));

    expect(() => answered.answerClaim(claimAnswer(1))).toThrow(
      DisagreementClaimAnsweredError,
    );
  });

  it('where no claim is in dispute, takes the claim that should have failed, or what was wrong', () => {
    const passed = openDisagreement('run_1', {
      claimResults: [true, true, true],
    });
    passed.pullEvents();
    const named = passed.answerNotMet(notMet(1, null));
    const unnamed = passed.answerNotMet(notMet(null, 'It broke the build.'));

    expect(named.state).toBe('answered');
    expect(named.claimsWrong).toEqual([1]);
    expect(named.pointsToNoClaim).toBe(false);
    expect(unnamed.pointsToNoClaim).toBe(true);
    expect(unnamed.notMet?.note).toBe('It broke the build.');
    expect(named.pullEvents().map((each) => each.kind)).toEqual([
      'judge-disagreement.answered',
    ]);
    expect(() => passed.answerNotMet(notMet(null, '  '))).toThrow(
      InvalidJudgeDisagreementError,
    );
    expect(() => named.answerNotMet(notMet(0, null))).toThrow(
      JudgeDisagreementAnsweredError,
    );
  });

  it('refuses what was not met where claims are in dispute', () => {
    expect(() =>
      openDisagreement('run_1').answerNotMet(notMet(null, 'It broke.')),
    ).toThrow(InvalidJudgeDisagreementError);
  });

  it('refuses a claim that should have failed beyond the judge’s claims', () => {
    expect(() =>
      openDisagreement('run_1', {
        claimResults: [true, true, true],
      }).answerNotMet(notMet(3, 'It broke the build.')),
    ).toThrow(InvalidJudgeDisagreementError);
  });

  it('is answered only once it has an answer, and keeps one answer per claim', () => {
    const fields = fieldsOf(openDisagreement('run_1'));
    const answer = ClaimAnswer.of({
      claim: 1,
      answer: 'judge-right',
      note: null,
      by: ADA,
      at: NOW,
    });

    expect(() =>
      JudgeDisagreement.rehydrate({
        ...fields,
        claimAnswers: [],
        answeredAt: NOW,
      }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      JudgeDisagreement.rehydrate({
        ...fields,
        claimAnswers: [answer, answer],
        answeredAt: null,
      }),
    ).toThrow(InconsistentStateError);
    expect(
      JudgeDisagreement.rehydrate({
        ...fields,
        claimAnswers: [answer],
        answeredAt: null,
      }).state,
    ).toBe('open');
  });

  it('withdraws once, keeps why, and tells the inbox', () => {
    const opened = openDisagreement('run_1');
    opened.pullEvents();
    const withdrawn = opened.withdraw(NOW, 'label-gone');

    expect(opened.withdrawnBecause).toBeNull();
    expect(withdrawn.state).toBe('withdrawn');
    expect(withdrawn.withdrawnAt).toEqual(NOW);
    expect(withdrawn.withdrawnBecause).toBe('label-gone');
    expect(withdrawn.withdraw(LATER, 'claims-changed')).toBe(withdrawn);
    expect(withdrawn.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'judge-disagreement.withdrawn',
        reason: 'label-gone',
      }),
    ]);
  });

  it('keeps a withdrawal time and its reason together', () => {
    const fields = fieldsOf(openDisagreement('run_1'));

    expect(() =>
      JudgeDisagreement.rehydrate({ ...fields, withdrawnAt: NOW }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      JudgeDisagreement.rehydrate({
        ...fields,
        withdrawnBecause: 'verdicts-agree',
      }),
    ).toThrow(InconsistentStateError);
    expect(
      JudgeDisagreement.rehydrate({
        ...fields,
        withdrawnAt: NOW,
        withdrawnBecause: 'claims-changed',
      }).withdrawnBecause,
    ).toBe('claims-changed');
  });

  it('withdrawn wins over answered, and keeps its answers', () => {
    const answered = openDisagreement('run_1')
      .answerClaim(claimAnswer(1))
      .answerClaim(claimAnswer(2));
    const withdrawn = answered.withdraw(NOW, 'verdicts-agree');

    expect(withdrawn.state).toBe('withdrawn');
    expect(withdrawn.claimAnswers).toHaveLength(2);
  });

  it('takes an answer only from the person it asks', () => {
    const asked = openDisagreement('run_1', { askedOf: ADA });

    expect(() => asked.answerClaim(claimAnswer(1, GRACE))).toThrow(
      JudgeDisagreementNotAskedOfYouError,
    );
    expect(asked.answerClaim(claimAnswer(1)).claimAnswers[0]?.by).toEqual(ADA);
  });

  it('takes answers from anyone on the team when it asks the team', () => {
    const teamQuestion = openDisagreement('run_1', { labelFrom: 'merged' });

    expect(teamQuestion.askedOf).toBeNull();
    expect(
      teamQuestion
        .answerClaim(claimAnswer(1, GRACE))
        .answerClaim(claimAnswer(2, ADA))
        .claimAnswers.map((each) => each.by),
    ).toEqual([GRACE, ADA]);
  });

  it('takes no answer once withdrawn', () => {
    const withdrawn = openDisagreement('run_1').withdraw(NOW, 'verdicts-agree');

    expect(() => withdrawn.answerClaim(claimAnswer(1))).toThrow(
      JudgeDisagreementWithdrawnError,
    );
    expect(() =>
      openDisagreement('run_2', { claimResults: [true, true, true] })
        .withdraw(NOW, 'claims-changed')
        .answerNotMet(notMet(0, null)),
    ).toThrow(JudgeDisagreementWithdrawnError);
  });

  it('says why it no longer holds: the claims changed, the label is gone, or the verdicts agree', () => {
    const disagreement = openDisagreement('run_1', {
      claimResults: [true, false, false],
    });
    const { rubricVersion } = disagreement;
    const labelFrom = (passes: boolean) =>
      passes ? ('accepted' as const) : ('sent-back' as const);

    expect(
      disagreement.noLongerHoldsBecause({
        rubricVersion,
        labelFrom: labelFrom(true),
      }),
    ).toBeNull();
    expect(
      disagreement.noLongerHoldsBecause({
        rubricVersion,
        labelFrom: labelFrom(false),
      }),
    ).toBe('verdicts-agree');
    expect(
      disagreement.noLongerHoldsBecause({ rubricVersion, labelFrom: null }),
    ).toBe('label-gone');
    expect(
      disagreement.noLongerHoldsBecause({
        rubricVersion: null,
        labelFrom: labelFrom(true),
      }),
    ).toBe('claims-changed');
    expect(
      disagreement.noLongerHoldsBecause({
        rubricVersion: null,
        labelFrom: null,
      }),
    ).toBe('claims-changed');
  });

  it('keeps the label that opened it while people stay on the same side', () => {
    const merged = openDisagreement('run_1', { labelFrom: 'merged' });

    expect(
      merged.noLongerHoldsBecause({
        rubricVersion: merged.rubricVersion,
        labelFrom: 'accepted',
      }),
    ).toBeNull();
  });

  it('opens beside the disagreements of its run only where none stands at its claims and none asked about the same verdict', () => {
    const merged = openDisagreement('run_1', { labelFrom: 'merged' });
    const { rubricVersion } = merged;
    const at = (
      labelFrom: 'merged' | 'marked-right',
      askedOf: UserId | null,
    ) => ({
      rubricVersion,
      labelFrom,
      askedOf,
    });

    expect(JudgeDisagreement.mayOpenBeside([], at('merged', null))).toBe(true);
    expect(
      JudgeDisagreement.mayOpenBeside([merged], at('marked-right', ADA)),
    ).toBe(false);

    const withdrawn = merged.withdraw(NOW, 'verdicts-agree');

    expect(
      JudgeDisagreement.mayOpenBeside([withdrawn], at('marked-right', ADA)),
    ).toBe(true);
    expect(
      JudgeDisagreement.mayOpenBeside([withdrawn], at('merged', null)),
    ).toBe(false);
    expect(
      JudgeDisagreement.mayOpenBeside([withdrawn], {
        ...at('merged', null),
        rubricVersion: NEXT_RUBRIC_VERSION,
      }),
    ).toBe(true);
  });

  it('disputes the claims the judge failed, and none where the judge passed', () => {
    expect(
      openDisagreement('run_1', { claimResults: [true, false, false] })
        .disputedClaims,
    ).toEqual([1, 2]);
    expect(
      openDisagreement('run_2', { claimResults: [true, true, true] })
        .disputedClaims,
    ).toEqual([]);
  });

  it('derives the claims in dispute from the verdict, whatever answers come later', () => {
    const opened = openDisagreement('run_1', {
      claimResults: [true, false, true],
      labelFrom: 'accepted',
    });
    const answered = opened.answerClaim(claimAnswer(1));

    expect(answered.disputedClaims).toEqual([1]);
    expect(answered.state).toBe('answered');
    expect(
      JudgeDisagreement.rehydrate(fieldsOf(answered)).disputedClaims,
    ).toEqual([1]);
  });

  it('keeps one answer for each claim the judge failed, and answers to no other claim', () => {
    const fields = fieldsOf(openDisagreement('run_1'));
    const answer = (claim: number) =>
      ClaimAnswer.of({
        claim,
        answer: 'judge-right',
        note: null,
        by: ADA,
        at: NOW,
      });

    expect(() =>
      JudgeDisagreement.rehydrate({ ...fields, claimAnswers: [answer(0)] }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      JudgeDisagreement.rehydrate({
        ...fields,
        claimAnswers: [answer(1), answer(1)],
      }),
    ).toThrow(InconsistentStateError);
    expect(JudgeDisagreement.rehydrate(fields).disputedClaims).toEqual([1, 2]);
  });

  it('keeps what was not met only where no claim is in dispute', () => {
    const passed = openDisagreement('run_1', {
      claimResults: [true, true, true],
    }).answerNotMet(notMet(1, null));
    const fields = fieldsOf(passed);

    expect(JudgeDisagreement.rehydrate(fields).state).toBe('answered');
    expect(() =>
      JudgeDisagreement.rehydrate({
        ...fields,
        labelFrom: 'accepted',
        verdict: { ...fields.verdict, claimResults: [true, false, true] },
      }),
    ).toThrow(InconsistentStateError);
  });

  it('loads only with one judge result for each claim', () => {
    const fields = fieldsOf(openDisagreement('run_1'));

    expect(() =>
      JudgeDisagreement.rehydrate({
        ...fields,
        verdict: { ...fields.verdict, claimResults: [true, false] },
      }),
    ).toThrow(InconsistentStateError);
  });

  it('loads a failed verdict only with a claim in dispute', () => {
    const fields = fieldsOf(openDisagreement('run_1'));

    expect(() =>
      JudgeDisagreement.rehydrate({
        ...fields,
        verdict: { ...fields.verdict, claimResults: [true, true, true] },
      }),
    ).toThrow(InconsistentStateError);
  });

  it('loads what was not met only on a claim of its judge', () => {
    const fields = fieldsOf(
      openDisagreement('run_1', {
        claimResults: [true, true, true],
      }).answerNotMet(notMet(1, null)),
    );

    expect(() =>
      JudgeDisagreement.rehydrate({
        ...fields,
        notMet: NotMetAnswer.of({
          shouldHaveFailed: 3,
          note: null,
          by: ADA,
          at: NOW,
        }),
      }),
    ).toThrow(InconsistentStateError);
  });
});
