import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteTeamMemories {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async deleteForTeam(teamId: TeamId): Promise<void> {
    for (const memory of await this.memories.ofTeam(teamId)) {
      await this.transaction.inTransaction(() => this.memories.remove(memory));
    }
  }
}
