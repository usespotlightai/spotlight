import { JudgeDisagreementVersionConflictError } from '@insights/domain/exceptions/judge-disagreement-version-conflict.error';
import { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import { DrizzleJudgeDisagreementRepository } from '@insights/infrastructure/persistence/drizzle/repositories/judge-disagreement.repository';
import { openDisagreement } from '@insights/judge-repair.fake-spec';
import { RUBRIC_VERSION } from '@insights/judging.fake-spec';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';

const ADA = UserId.of('user_ada');
const GRACE = UserId.of('user_grace');
const FIRST = new Date('2026-11-15T10:00:00.000Z');
const SECOND = new Date('2026-11-15T11:00:00.000Z');

let database: TestDatabase;
let disagreements: DrizzleJudgeDisagreementRepository;
const dispatched: DomainEvent[] = [];

const answerOf = (
  claim: number,
  by: UserId,
  now: Date,
  note: string | null,
) => ({
  claim,
  answer: 'claim-wrong' as const,
  note,
  by,
  now,
});

const stored = async (runId: string) => {
  const found = await disagreements.find(
    JudgeDisagreementId.of(`disagreement_${runId}`),
  );
  if (!found) {
    throw new Error(`no disagreement for ${runId}`);
  }

  return found;
};

beforeAll(async () => {
  database = await openDatabase('judge_disagreement_answers');
  const events: DomainEventDispatcher = {
    dispatch: async (each: readonly DomainEvent[]) => {
      dispatched.push(...each);
    },
  };
  disagreements = new DrizzleJudgeDisagreementRepository(
    new DrizzleContext(database.db),
    events,
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('answers to a judge disagreement, one claim at a time', () => {
  it('keeps each claim’s answer, note, person and day, and is answered after the last one', async () => {
    await disagreements.add(openDisagreement('run_1', { labelFrom: 'merged' }));
    await disagreements.save(
      (await stored('run_1')).answerClaim(
        answerOf(1, ADA, FIRST, 'The lint step must pass.'),
      ),
    );

    const half = await stored('run_1');

    expect(half.state).toBe('open');
    expect(half.answeredAt).toBeNull();
    expect(
      await disagreements.answeredAt({
        stationId: StationId.of('station_1'),
        rubricVersion: RUBRIC_VERSION,
        since: null,
      }),
    ).toEqual([]);

    dispatched.length = 0;
    await disagreements.save(
      half.answerClaim(answerOf(2, GRACE, SECOND, null)),
    );
    const whole = await stored('run_1');

    expect(whole.state).toBe('answered');
    expect(whole.answeredAt).toEqual(SECOND);
    expect(
      whole.claimAnswers.map((each) => ({
        claim: each.claim,
        answer: each.answer,
        note: each.note,
        by: each.by.value,
        at: each.at,
      })),
    ).toEqual([
      {
        claim: 1,
        answer: 'claim-wrong',
        note: 'The lint step must pass.',
        by: 'user_ada',
        at: FIRST,
      },
      {
        claim: 2,
        answer: 'claim-wrong',
        note: null,
        by: 'user_grace',
        at: SECOND,
      },
    ]);
    expect(dispatched.map((each) => each.kind)).toEqual([
      'judge-disagreement.claim-answered',
      'judge-disagreement.answered',
    ]);
  });

  it('refuses the second of two people answering the same claim at once', async () => {
    await disagreements.add(openDisagreement('run_2', { labelFrom: 'merged' }));
    const seen = await stored('run_2');

    await disagreements.save(seen.answerClaim(answerOf(1, ADA, FIRST, null)));

    await expect(
      disagreements.save(seen.answerClaim(answerOf(1, GRACE, FIRST, null))),
    ).rejects.toBeInstanceOf(JudgeDisagreementVersionConflictError);
    expect((await stored('run_2')).claimAnswers.map((each) => each.by)).toEqual(
      [ADA],
    );
  });

  it('keeps what was not met where no claim is in dispute', async () => {
    await disagreements.add(
      openDisagreement('run_3', { claimResults: [true, true, true] }),
    );
    await disagreements.save(
      (await stored('run_3')).answerNotMet({
        shouldHaveFailed: null,
        note: 'It broke the login page.',
        by: ADA,
        now: FIRST,
      }),
    );
    const answered = await stored('run_3');

    expect(answered.state).toBe('answered');
    expect(answered.notMet?.note).toBe('It broke the login page.');
    expect(answered.pointsToNoClaim).toBe(true);
    expect(answered.answeredAt).toEqual(FIRST);
  });

  it('derives the claims in dispute from its stored verdict, and keeps why it was withdrawn', async () => {
    await disagreements.add(
      openDisagreement('run_4', {
        claimResults: [true, false, true],
        labelFrom: 'accepted',
      }),
    );
    await disagreements.save(
      (await stored('run_4')).withdraw(SECOND, 'label-gone'),
    );
    const withdrawn = await stored('run_4');

    expect(withdrawn.disputedClaims).toEqual([1]);
    expect(withdrawn.withdrawnAt).toEqual(SECOND);
    expect(withdrawn.withdrawnBecause).toBe('label-gone');
  });

  it('lists the disagreements still standing in id order, a page at a time', async () => {
    for (const runId of ['run_s1', 'run_s2', 'run_s3']) {
      await disagreements.add(openDisagreement(runId));
    }
    await disagreements.save(
      (await stored('run_s2')).withdraw(SECOND, 'label-gone'),
    );
    const after = JudgeDisagreementId.of('disagreement_run_r');

    const first = await disagreements.standing(after, 1);
    const second = await disagreements.standing(first[0]?.id ?? null, 1);

    expect(first.map((each) => each.runId.value)).toEqual(['run_s1']);
    expect(second.map((each) => each.runId.value)).toEqual(['run_s3']);
    expect(
      (await disagreements.standing(after, 10)).map((each) => each.runId.value),
    ).toEqual(['run_s1', 'run_s3']);
  });
});
