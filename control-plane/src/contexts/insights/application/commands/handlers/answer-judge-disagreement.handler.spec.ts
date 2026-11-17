import { AnswerDisagreementClaimCommand } from '@insights/application/commands/answer-disagreement-claim.command';
import { AnswerJudgeDisagreementCommand } from '@insights/application/commands/answer-judge-disagreement.command';
import { AnswerDisagreementClaimHandler } from '@insights/application/commands/handlers/answer-disagreement-claim.handler';
import { AnswerJudgeDisagreementHandler } from '@insights/application/commands/handlers/answer-judge-disagreement.handler';
import { ReadJudgeDisagreementHandler } from '@insights/application/queries/handlers/read-judge-disagreement.handler';
import { ReadJudgeDisagreementQuery } from '@insights/application/queries/read-judge-disagreement.query';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import { TeamJudgeDisagreements } from '@insights/application/services/team-judge-disagreements.service';
import {
  type LabelSource,
  passesOn,
} from '@insights/domain/value-objects/label-source';
import {
  JudgeDisagreementsInMemory,
  OPENED_AT,
  openDisagreement,
} from '@insights/judge-repair.fake-spec';
import {
  inTransaction,
  NOBODY_ELSE,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const ANSWERED_AT = new Date('2026-10-02T10:00:00.000Z');

const disagreeing = async (
  labelFrom: LabelSource = 'accepted',
  askedOf?: UserId,
) => {
  const disagreements = new JudgeDisagreementsInMemory();
  await disagreements.add(
    openDisagreement('run_1', {
      labelFrom,
      claimResults: passesOn(labelFrom)
        ? [true, false, false]
        : [true, true, true],
      askedOf,
    }),
  );
  const access = new InsightsAccess({
    ...NOBODY_ELSE,
    viewerOf: async (_teamId, principal) =>
      principal.userId.equals(UserId.of('user_stranger'))
        ? null
        : { workspaceId: WORKSPACE, by: principal.userId },
  });
  const onTeam = new TeamJudgeDisagreements(access, disagreements);
  const clock = {
    now: () => ANSWERED_AT,
    sleep: async () => {},
  };
  const answering = new AnswerDisagreementClaimHandler(
    onTeam,
    disagreements,
    inTransaction,
    clock,
  );
  const answeringNotMet = new AnswerJudgeDisagreementHandler(
    onTeam,
    disagreements,
    inTransaction,
    clock,
  );
  const reading = new ReadJudgeDisagreementHandler(onTeam);

  return {
    disagreements,
    answer: (
      claim: number,
      answer = 'judge-right',
      note: string | null = null,
      viewer = 'user_ada',
      teamId = 'team_1',
    ) =>
      answering.execute(
        new AnswerDisagreementClaimCommand(
          teamId,
          'disagreement_run_1',
          viewer,
          claim,
          answer,
          note,
        ),
      ),
    notMet: (
      note: string | null,
      shouldHaveFailed: number | null = null,
      viewer = 'user_ada',
    ) =>
      answeringNotMet.execute(
        new AnswerJudgeDisagreementCommand(
          'team_1',
          'disagreement_run_1',
          viewer,
          note,
          shouldHaveFailed,
        ),
      ),
    read: (
      viewer = 'user_ada',
      teamId = 'team_1',
      disagreementId = 'disagreement_run_1',
    ) =>
      reading.execute(
        new ReadJudgeDisagreementQuery(teamId, disagreementId, viewer),
      ),
  };
};

describe('answering a judge disagreement', () => {
  it('shows the failed claims with their reasons before an answer', async () => {
    const run = await disagreeing();

    const disagreement = await run.read();

    expect(disagreement).toMatchObject({
      id: 'disagreement_run_1',
      runId: 'run_1',
      taskId: 'task_run_1',
      direction: 'judge-failed',
      labelFrom: 'accepted',
      openedAt: OPENED_AT.toISOString(),
      disputedClaims: [1, 2],
      answers: [],
      notMet: null,
      withdrawnBecause: null,
    });
    expect(disagreement.claims.map((each) => each.judgeMet)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('keeps each claim’s answer with its own note, and who gave it', async () => {
    const run = await disagreeing();

    await run.answer(1, 'judge-right', 'The lint step must pass.');
    await run.answer(
      2,
      'claim-wrong',
      'The test sits in another file.',
      'user_grace',
    );
    const disagreement = await run.read();

    expect(disagreement.answers).toEqual([
      {
        claim: 1,
        answer: 'judge-right',
        note: 'The lint step must pass.',
        answeredBy: 'user_ada',
        answeredAt: ANSWERED_AT.toISOString(),
      },
      {
        claim: 2,
        answer: 'claim-wrong',
        note: 'The test sits in another file.',
        answeredBy: 'user_grace',
        answeredAt: ANSWERED_AT.toISOString(),
      },
    ]);
    expect(disagreement.state).toBe('answered');
  });

  it('stays open, and tells the inbox nothing, until the last claim in dispute has an answer', async () => {
    const run = await disagreeing();
    run.disagreements.events.length = 0;

    await run.answer(1);

    expect((await run.read()).state).toBe('open');
    expect(run.disagreements.events.map((each) => each.kind)).toEqual([
      'judge-disagreement.claim-answered',
    ]);

    await run.answer(2);

    expect(run.disagreements.events.map((each) => each.kind)).toEqual([
      'judge-disagreement.claim-answered',
      'judge-disagreement.claim-answered',
      'judge-disagreement.answered',
    ]);
  });

  it('asks what was wrong when the judge passed a run the person failed', async () => {
    const run = await disagreeing('sent-back');

    await run.notMet('It broke the build.', 0);

    expect((await run.read()).notMet).toEqual({
      claim: 0,
      note: 'It broke the build.',
      answeredBy: 'user_ada',
      answeredAt: ANSWERED_AT.toISOString(),
    });
  });

  it('refuses a claim not in dispute', async () => {
    const run = await disagreeing('sent-back');

    expect((await run.read()).disputedClaims).toEqual([]);
    await expect(run.answer(0, 'claim-wrong')).rejects.toMatchObject({
      kind: 'invalid',
    });
    await expect(run.answer(0, 'maybe')).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('says why Spotlight withdrew the question, and takes no answer after', async () => {
    const run = await disagreeing();
    const [open] = [...run.disagreements.stored.values()];
    if (open) {
      await run.disagreements.save(open.withdraw(ANSWERED_AT, 'label-gone'));
    }

    expect(await run.read()).toMatchObject({
      state: 'withdrawn',
      withdrawnAt: ANSWERED_AT.toISOString(),
      withdrawnBecause: 'label-gone',
    });
    await expect(run.answer(1)).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('takes one answer for each claim', async () => {
    const run = await disagreeing();
    await run.answer(1);

    await expect(run.answer(1, 'claim-wrong')).rejects.toMatchObject({
      kind: 'conflict',
    });
  });

  it('refuses an answer from a team member the question does not ask', async () => {
    const run = await disagreeing('accepted', UserId.of('user_ada'));

    await expect(
      run.answer(1, 'judge-right', null, 'user_grace'),
    ).rejects.toMatchObject({ kind: 'not-allowed' });
    expect((await run.read()).answers).toEqual([]);

    await run.answer(1);
    await run.answer(2);

    expect((await run.read()).state).toBe('answered');
  });

  it('finds no disagreement on another team or for a stranger', async () => {
    const run = await disagreeing();

    await expect(run.read('user_ada', 'team_2')).rejects.toMatchObject({
      kind: 'not-found',
    });
    await expect(
      run.read('user_ada', 'team_1', 'disagreement_other'),
    ).rejects.toMatchObject({
      kind: 'not-found',
    });
    await expect(run.read('user_stranger')).rejects.toBeDefined();
  });
});
