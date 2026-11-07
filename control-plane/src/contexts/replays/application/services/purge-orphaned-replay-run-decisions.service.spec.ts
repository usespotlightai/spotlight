import { DeleteReplayRunDecisions } from '@replays/application/services/delete-replay-run-decisions.service';
import { PurgeOrphanedReplayRunDecisions } from '@replays/application/services/purge-orphaned-replay-run-decisions.service';
import {
  InMemoryReplayRunDecisions,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { ReplayRunDecision } from '@replays/domain/aggregates/replay-run-decision.aggregate';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const HOUR = 60 * 60_000;
const DECIDED = new Date('2026-11-07T12:00:00.000Z');

const decidedIn = (run: string) =>
  ReplayRunDecision.decidedToQueue(RunId.of(run), {
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    replayId: ReplayId.of('replay_gone'),
  });

const purging = () => {
  const decisions = new InMemoryReplayRunDecisions();
  const clock = { at: DECIDED };
  const purge = new PurgeOrphanedReplayRunDecisions(
    new DeleteReplayRunDecisions(decisions, TRANSACTION),
    { now: () => clock.at, sleep: async () => {} },
  );

  decisions.now = DECIDED;
  decisions.deletedReplays.add('replay_gone');

  return { decisions, clock, purge };
};

describe('PurgeOrphanedReplayRunDecisions', () => {
  it('leaves a decision of a deleted replay to the dispatch that is still deciding it (R7-04)', async () => {
    const { decisions, clock, purge } = purging();
    await decisions.add(decidedIn('run_1'));

    clock.at = new Date(DECIDED.getTime() + HOUR - 1);
    await purge.processDue();

    expect([...decisions.decisions.keys()]).toEqual(['run_1']);
  });

  it('purges a decision a stopped process left for a deleted replay, once an hour (R7-04)', async () => {
    const { decisions, clock, purge } = purging();
    await decisions.add(decidedIn('run_1'));

    clock.at = new Date(DECIDED.getTime() + HOUR - 1);
    await purge.processDue();
    clock.at = new Date(DECIDED.getTime() + HOUR + 1);
    await purge.processDue();

    expect([...decisions.decisions.keys()]).toEqual(['run_1']);

    clock.at = new Date(DECIDED.getTime() + 2 * HOUR);
    await purge.processDue();

    expect([...decisions.decisions.keys()]).toEqual([]);
  });
});
