import { ReplayCheckDeletionDue } from '@replays/domain/events/replay-check-deletion-due.event';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteReplayChecks {
  constructor(
    private readonly checks: ReplayCheckRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async deleteForTeam(
    teamId: TeamId,
    workspaceId: WorkspaceId,
  ): Promise<readonly DomainEvent[]> {
    return (await this.checks.ofTeam(teamId)).map(
      (each) => new ReplayCheckDeletionDue(each.id, workspaceId),
    );
  }

  async deleteForSet(
    setId: ReplaySetId,
    workspaceId: WorkspaceId,
  ): Promise<readonly DomainEvent[]> {
    return (await this.checks.ofSet(setId)).map(
      (each) => new ReplayCheckDeletionDue(each.id, workspaceId),
    );
  }

  check(id: ReplayCheckId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const check = await this.checks.find(id);

      if (check) {
        await this.checks.save(check.delete());
      }
    });
  }
}
