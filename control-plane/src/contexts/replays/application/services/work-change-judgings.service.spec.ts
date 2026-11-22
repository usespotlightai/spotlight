import {
  FakeChangeJudge,
  InMemoryChangeJudgings,
} from '@replays/application/services/judgings.fake-spec';
import { WorkChangeJudgings } from '@replays/application/services/work-change-judgings.service';
import { ChangeJudging } from '@replays/domain/aggregates/change-judging.aggregate';
import { NOW } from '@replays/domain/replays.fake-spec';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { WAIT_MS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const logger: LoggerPort = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const SESSION = {
  workspaceId: 'ws_1',
  purpose: 'insights.judge',
  key: 'any',
};

const working = async (judge: FakeChangeJudge, at: () => Date = () => NOW) => {
  const judgings = new InMemoryChangeJudgings();
  await judgings.add(
    ChangeJudging.requested({
      runId: RunId.of('replay_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      criteria: JudgeCriteria.of({ claims: ['It drains.'] }),
      reference: RunId.of('original_1'),
      now: NOW,
    }),
  );
  const work = new WorkChangeJudgings(
    judgings,
    judge,
    { now: at, sleep: async () => {} },
    { inTransaction: (run) => run() },
    logger,
    { report: () => undefined },
    telemetryInMemory(),
  );

  await work.processDue();
  await work.idle();

  return {
    work,
    judgings,
    judging: await judgings.of(RunId.of('replay_1'), 1),
  };
};

describe('WorkChangeJudgings', () => {
  it('asks for the judging session of the judging’s round', async () => {
    const judge = new FakeChangeJudge();

    await working(judge);

    expect(judge.orders[0]?.round).toMatchObject({
      runId: RunId.of('replay_1'),
      judging: 1,
      attempt: 1,
    });
  });

  it('wakes the judging that waits on a settled session, and leaves one of another workspace alone', async () => {
    const judge = new FakeChangeJudge();
    judge.awaiting = true;
    const later = new Date(NOW.getTime() + 1_000);
    let now = NOW;
    const { work, judgings } = await working(judge, () => now);
    judge.settledRound = judge.orders[0]?.round ?? null;
    now = later;

    await work.sessionSettled({ ...SESSION, workspaceId: 'ws_2' });
    const untouched = await judgings.of(RunId.of('replay_1'), 1);
    await work.sessionSettled(SESSION);
    await work.sessionSettled(SESSION);
    const woken = await judgings.of(RunId.of('replay_1'), 1);

    expect(untouched?.job?.nextAttemptAt).toEqual(
      new Date(NOW.getTime() + WAIT_MS),
    );
    expect(woken?.job?.nextAttemptAt).toEqual(later);
    expect(woken?.version).toBe((untouched?.version ?? 0) + 1);
  });

  it('waits for the judging session without spending the attempt', async () => {
    const judge = new FakeChangeJudge();
    judge.awaiting = true;

    const { judging } = await working(judge);

    expect(judging?.hasPendingJob).toBe(true);
    expect(judging?.job?.attempts).toBe(0);
    expect(judging?.job?.nextAttemptAt).toEqual(
      new Date(NOW.getTime() + WAIT_MS),
    );
  });
});
