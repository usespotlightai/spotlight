import type { DuplicateCheckRepository } from '@memory/domain/repositories/duplicate-check.repository';
import type {
  MemoryUpkeepRepository,
  MemoryUpkeepScheduleRepository,
} from '@memory/domain/repositories/memory-upkeep.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteTeamMemories {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly transaction: TransactionPort,
    private readonly upkeeps: MemoryUpkeepRepository,
    private readonly schedules: MemoryUpkeepScheduleRepository,
    private readonly checks: DuplicateCheckRepository,
  ) {}

  async deleteForTeam(teamId: TeamId): Promise<void> {
    await this.upkeepRemoved(teamId);

    for (
      let left = await this.memories.ofTeam(teamId);
      left.length > 0;
      left = await this.memories.ofTeam(teamId)
    ) {
      for (const memory of left) {
        await this.transaction.inTransaction(() =>
          this.memories.save(memory.delete()),
        );
      }
    }

    await this.upkeepRemoved(teamId);
  }

  private async upkeepRemoved(teamId: TeamId): Promise<void> {
    await this.transaction.inTransaction(async () => {
      const schedule = await this.schedules.ofTeam(teamId);

      if (schedule) {
        await this.schedules.remove(schedule);
      }
    });

    for (const upkeep of await this.upkeeps.ofTeam(teamId)) {
      await this.transaction.inTransaction(() => this.upkeeps.remove(upkeep));
    }

    for (const check of await this.checks.ofTeam(teamId)) {
      await this.transaction.inTransaction(() => this.checks.remove(check));
    }
  }
}
