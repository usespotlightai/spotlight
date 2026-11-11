import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteReplayChecks {
  constructor(
    private readonly checks: ReplayCheckRepository,
    private readonly transaction: TransactionPort,
  ) {}

  ofTeam(teamId: TeamId): Promise<void> {
    return this.deleted(() => this.checks.ofTeam(teamId));
  }

  ofSet(setId: ReplaySetId): Promise<void> {
    return this.deleted(() => this.checks.ofSet(setId));
  }

  private async deleted(
    found: () => Promise<readonly ReplayCheck[]>,
  ): Promise<void> {
    for (const check of await found()) {
      await this.transaction.inTransaction(() =>
        this.checks.save(check.delete()),
      );
    }
  }
}
