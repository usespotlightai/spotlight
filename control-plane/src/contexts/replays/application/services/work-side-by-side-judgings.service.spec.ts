import {
  FakePairJudge,
  InMemorySideBySideJudgings,
} from '@replays/application/services/judgings.fake-spec';
import { WorkSideBySideJudgings } from '@replays/application/services/work-side-by-side-judgings.service';
import { SideBySideJudging } from '@replays/domain/aggregates/side-by-side-judging.aggregate';
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
  purpose: 'insights.pair-judge',
  key: 'any',
};

const working = async (judge: FakePairJudge, at: () => Date = () => NOW) => {
  const judgings = new InMemorySideBySideJudgings();
  await judgings.add(
    SideBySideJudging.requested({
      runId: RunId.of('replay_1'),
      otherRunId: RunId.of('replay_2'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      criteria: JudgeCriteria.of({ claims: ['It drains.'] }),
      reference: RunId.of('original_1'),
      now: NOW,
    }),
  );
  const work = new WorkSideBySideJudgings(
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
    judging: await judgings.of(RunId.of('replay_1'), RunId.of('replay_2')),
  };
};

describe('WorkSideBySideJudgings', () => {
  it('asks for the judging sessions of the judging’s round', async () => {
    const judge = new FakePairJudge();

    await working(judge);

    expect(judge.orders[0]?.round).toMatchObject({
      runId: RunId.of('replay_1'),
      otherRunId: RunId.of('replay_2'),
      attempt: 1,
    });
  });

  it('wakes the judging that waits on a settled session', async () => {
    const judge = new FakePairJudge();
    judge.awaiting = true;
    const later = new Date(NOW.getTime() + 1_000);
    let now = NOW;
    const { work, judgings } = await working(judge, () => now);
    judge.settledRound = judge.orders[0]?.round ?? null;
    now = later;

    await work.sessionSettled(SESSION);

    expect(
      (await judgings.of(RunId.of('replay_1'), RunId.of('replay_2')))?.job
        ?.nextAttemptAt,
    ).toEqual(later);
  });

  it('waits for the judging sessions without spending the attempt', async () => {
    const judge = new FakePairJudge();
    judge.awaiting = true;

    const { judging } = await working(judge);

    expect(judging?.hasPendingJob).toBe(true);
    expect(judging?.job?.attempts).toBe(0);
    expect(judging?.job?.nextAttemptAt).toEqual(
      new Date(NOW.getTime() + WAIT_MS),
    );
  });
});
