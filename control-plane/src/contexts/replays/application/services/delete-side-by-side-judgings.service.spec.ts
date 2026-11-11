import { DeleteSideBySideJudgings } from '@replays/application/services/delete-side-by-side-judgings.service';
import { InMemorySideBySideJudgings } from '@replays/application/services/judgings.fake-spec';
import { SideBySideJudging } from '@replays/domain/aggregates/side-by-side-judging.aggregate';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-11T10:00:00.000Z');
const TEAM = TeamId.of('team_1');
const TRANSACTION = { inTransaction: <T>(work: () => Promise<T>) => work() };

const requested = (run: string, other: string) =>
  SideBySideJudging.requested({
    runId: RunId.of(run),
    otherRunId: RunId.of(other),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    criteria: JudgeCriteria.of({ rubric: null, claims: ['It retries.'] }),
    reference: RunId.of('run_reference'),
    now: NOW,
  });

class LeasedWhileListed extends InMemorySideBySideJudgings {
  leases = 0;

  override async ofTeam(teamId: TeamId): Promise<readonly SideBySideJudging[]> {
    const listed = await super.ofTeam(teamId);

    for (const each of listed) {
      await super.save(each.leaseJob(NOW));
      this.leases += 1;
    }

    return listed;
  }
}

class GoneOnceListed extends InMemorySideBySideJudgings {
  override async of(): Promise<SideBySideJudging | null> {
    return null;
  }
}

describe('DeleteSideBySideJudgings', () => {
  it('deletes every judging of the team, also one the judging worker leased after the list was read', async () => {
    const judgings = new LeasedWhileListed();
    await judgings.add(requested('run_1', 'run_2'));
    await judgings.add(requested('run_3', 'run_4'));

    await new DeleteSideBySideJudgings(judgings, TRANSACTION).ofTeam(TEAM);

    expect(judgings.leases).toBe(2);
    expect(judgings.stored.size).toBe(0);
  });

  it('skips a judging that is gone by the time it is deleted', async () => {
    const judgings = new GoneOnceListed();
    await judgings.add(requested('run_1', 'run_2'));

    await new DeleteSideBySideJudgings(judgings, TRANSACTION).ofTeam(TEAM);

    expect(judgings.stored.size).toBe(1);
  });
});
