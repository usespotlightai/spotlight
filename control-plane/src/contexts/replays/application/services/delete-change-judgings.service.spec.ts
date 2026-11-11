import { DeleteChangeJudgings } from '@replays/application/services/delete-change-judgings.service';
import { InMemoryChangeJudgings } from '@replays/application/services/judgings.fake-spec';
import { ChangeJudging } from '@replays/domain/aggregates/change-judging.aggregate';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-11T10:00:00.000Z');
const TEAM = TeamId.of('team_1');
const TRANSACTION = { inTransaction: <T>(work: () => Promise<T>) => work() };

const requested = (run: string) =>
  ChangeJudging.requested({
    runId: RunId.of(run),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    criteria: JudgeCriteria.of({ rubric: null, claims: ['It retries.'] }),
    reference: null,
    now: NOW,
  });

class LeasedWhileListed extends InMemoryChangeJudgings {
  leases = 0;

  override async ofTeam(teamId: TeamId): Promise<readonly ChangeJudging[]> {
    const listed = await super.ofTeam(teamId);

    for (const each of listed) {
      await super.save(each.leaseJob(NOW));
      this.leases += 1;
    }

    return listed;
  }
}

class GoneOnceListed extends InMemoryChangeJudgings {
  override async of(): Promise<ChangeJudging | null> {
    return null;
  }
}

describe('DeleteChangeJudgings', () => {
  it('deletes every judging of the team, also one the judging worker leased after the list was read', async () => {
    const judgings = new LeasedWhileListed();
    await judgings.add(requested('run_1'));
    await judgings.add(requested('run_2'));

    await new DeleteChangeJudgings(judgings, TRANSACTION).ofTeam(TEAM);

    expect(judgings.leases).toBe(2);
    expect(judgings.stored.size).toBe(0);
  });

  it('skips a judging that is gone by the time it is deleted', async () => {
    const judgings = new GoneOnceListed();
    await judgings.add(requested('run_1'));

    await new DeleteChangeJudgings(judgings, TRANSACTION).ofTeam(TEAM);

    expect(judgings.stored.size).toBe(1);
  });
});
