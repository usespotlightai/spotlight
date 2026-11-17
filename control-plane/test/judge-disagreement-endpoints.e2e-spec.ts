import { randomUUID } from 'node:crypto';

import { JudgeDisagreement } from '@insights/domain/aggregates/judge-disagreement.aggregate';
import { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import { DrizzleJudgeDisagreementRepository } from '@insights/infrastructure/persistence/drizzle/repositories/judge-disagreement.repository';
import { CLAIMS, RUBRIC_VERSION, reasonOf } from '@insights/judging.fake-spec';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { createTeam } from './support/team';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

const opened = async (claimResults: readonly boolean[]): Promise<string> => {
  const id = randomUUID();
  const passes = claimResults.every(Boolean);

  await app.get(DrizzleJudgeDisagreementRepository).add(
    JudgeDisagreement.open({
      id: JudgeDisagreementId.of(id),
      runId: RunId.of(randomUUID()),
      workspaceId: team.workspaceId,
      location: RunLocation.of({
        teamId: team.teamId,
        lineId: team.line.id,
        stationId: team.stationId,
        taskId: TaskId.of(randomUUID()),
      }),
      verdict: {
        scoreId: ScoreId.of(randomUUID()),
        rubricVersion: RUBRIC_VERSION,
        claims: CLAIMS,
        claimResults,
        passes,
        reasons: claimResults.map((_, at) => reasonOf(`Claim ${at}.`, at)),
      },
      label: { from: passes ? 'sent-back' : 'accepted' },
      askedOf: null,
      now: new Date(),
    }),
  );

  return id;
};

const path = (id: string) =>
  `/api/teams/${team.teamId.value}/judge-disagreements/${id}`;

const answerClaim = (id: string, claim: number | string, body: object) =>
  served(app)
    .post(`${path(id)}/claims/${claim}/answer`)
    .set(TEST_USER_HEADER, team.owner.value)
    .send(body);

const answerNotMet = (id: string, body: object) =>
  served(app)
    .post(`${path(id)}/answer`)
    .set(TEST_USER_HEADER, team.owner.value)
    .send(body);

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `disagreements-${randomUUID().slice(0, 8)}`,
  );
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('answering a judge disagreement over HTTP, one claim at a time', () => {
  it('takes each claim in dispute with its own note, and is answered after the last one', async () => {
    const id = await opened([true, false, false]);

    const first = await answerClaim(id, 1, {
      answer: 'judge-right',
      note: 'The lint step must pass.',
    });

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      state: 'open',
      disputedClaims: [1, 2],
      answers: [
        {
          claim: 1,
          answer: 'judge-right',
          note: 'The lint step must pass.',
          answeredBy: team.owner.value,
        },
      ],
      notMet: null,
    });

    const second = await answerClaim(id, 2, {
      answer: 'claim-wrong',
      note: null,
    });

    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      state: 'answered',
      answers: [{ claim: 1 }, { claim: 2, answer: 'claim-wrong', note: null }],
    });
  });

  it('answers 409 to a second answer for the same claim, and 422 to a claim not in dispute', async () => {
    const id = await opened([true, false, false]);
    await answerClaim(id, 1, { answer: 'judge-right', note: null });

    expect(
      (await answerClaim(id, 1, { answer: 'claim-wrong', note: null })).status,
    ).toBe(409);
    expect(
      (await answerClaim(id, 0, { answer: 'claim-wrong', note: null })).status,
    ).toBe(422);
    expect(
      (await answerClaim(id, 2, { answer: 'maybe', note: null })).status,
    ).toBe(422);
    expect(
      (await answerClaim(id, 'two', { answer: 'claim-wrong', note: null }))
        .status,
    ).toBe(400);
    expect(
      (await answerNotMet(id, { shouldHaveFailed: 1, note: null })).status,
    ).toBe(422);
  });

  it('takes one answer naming what was not met where no claim is in dispute', async () => {
    const id = await opened([true, true, true]);

    expect(
      (await answerClaim(id, 0, { answer: 'claim-wrong', note: null })).status,
    ).toBe(422);

    const answered = await answerNotMet(id, {
      shouldHaveFailed: null,
      note: 'It broke the login page.',
    });

    expect(answered.status).toBe(200);
    expect(answered.body).toMatchObject({
      state: 'answered',
      answers: [],
      notMet: { claim: null, note: 'It broke the login page.' },
    });
    expect(
      (await answerNotMet(id, { shouldHaveFailed: 0, note: null })).status,
    ).toBe(409);
  });
});
