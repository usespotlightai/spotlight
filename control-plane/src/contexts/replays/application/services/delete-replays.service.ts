import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteReplays {
  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async setsOfTeam(teamId: TeamId): Promise<void> {
    for (const set of await this.sets.ofTeam(teamId)) {
      await this.transaction.inTransaction(() => this.sets.save(set.delete()));
    }
  }

  async candidatesOfTeam(teamId: TeamId): Promise<void> {
    for (const candidate of await this.candidates.ofTeam(teamId)) {
      await this.transaction.inTransaction(() =>
        this.candidates.save(candidate.delete()),
      );
    }
  }

  async replaysOfSet(setId: ReplaySetId): Promise<void> {
    for (const replay of await this.replays.ofSet(setId)) {
      await this.transaction.inTransaction(() =>
        this.replays.save(replay.delete()),
      );
    }
  }
}
