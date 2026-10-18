import type { DeleteCandidateCommand } from '@replays/application/commands/delete-candidate.command';
import type { PeoplePort } from '@replays/application/ports/people.port';
import { CandidateInUseError } from '@replays/domain/exceptions/candidate-in-use.error';
import { CandidateIsLiveError } from '@replays/domain/exceptions/candidate-is-live.error';
import { CandidateManagedBySpotlightError } from '@replays/domain/exceptions/candidate-managed-by-spotlight.error';
import { CandidateVersionConflictError } from '@replays/domain/exceptions/candidate-version-conflict.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class DeleteCandidateHandler
  implements CommandHandlerPort<DeleteCandidateCommand, ResourceDeleted | null>
{
  constructor(
    private readonly people: PeoplePort,
    private readonly candidates: CandidateRepository,
    private readonly replays: ReplayRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteCandidateCommand,
  ): Promise<ResourceDeleted | null> {
    const id = CandidateId.of(command.candidateId);

    try {
      const seen = await this.candidates.find(id);
      const membership = seen
        ? await this.people.membershipOn(
            seen.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!seen || !membership) {
        return null;
      }

      if (!membership.mayPlan) {
        return forbiddenTo('plan');
      }

      const deleted = await this.transaction.inTransaction(async () => {
        const candidate = await this.candidates.locked(id);

        if (!candidate) {
          return false;
        }

        candidate.assertVersion(command.expectedVersion);

        const replays = await this.replays.ofCandidate(id);

        await this.candidates.save(
          candidate.delete(
            replays.some((each) => each.isInProgress),
            Attribution.of(command.actor, candidate.workspaceId),
          ),
        );

        return true;
      });

      return deleted ? { outcome: 'deleted' } : null;
    } catch (error) {
      if (error instanceof CandidateVersionConflictError) {
        const current = await this.candidates.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (
        error instanceof CandidateInUseError ||
        error instanceof CandidateIsLiveError ||
        error instanceof CandidateManagedBySpotlightError
      ) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsApplicationError(error);
    }
  }
}
