import { CandidateDeletionRequested } from '@replays/domain/events/candidate-deletion-requested.event';
import { ReplayDeletionRequested } from '@replays/domain/events/replay-deletion-requested.event';
import { ReplaySetDeletionRequested } from '@replays/domain/events/replay-set-deletion-requested.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteReplays {
  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async deleteForTeam(
    teamId: TeamId,
    workspaceId: WorkspaceId,
  ): Promise<readonly DomainEvent[]> {
    const sets = await this.sets.ofTeam(teamId);
    const candidates = await this.candidates.ofTeam(teamId);

    return [
      ...sets.map(
        (each) => new ReplaySetDeletionRequested(each.id, workspaceId),
      ),
      ...candidates.map(
        (each) => new CandidateDeletionRequested(each.id, workspaceId),
      ),
    ];
  }

  async deleteForSet(
    setId: ReplaySetId,
    workspaceId: WorkspaceId,
  ): Promise<readonly DomainEvent[]> {
    return (await this.replays.ofSet(setId)).map(
      (each) => new ReplayDeletionRequested(each.id, workspaceId),
    );
  }

  replay(id: ReplayId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const replay = await this.replays.find(id);

      if (replay) {
        await this.replays.save(replay.delete());
      }
    });
  }

  set(id: ReplaySetId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const set = await this.sets.find(id);

      if (set) {
        await this.sets.save(set.delete());
      }
    });
  }

  candidate(id: CandidateId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const candidate = await this.candidates.find(id);

      if (candidate) {
        await this.candidates.save(candidate.cascadeDelete());
      }
    });
  }
}
