import type { WithdrawCandidateCommand } from '@replays/application/commands/withdraw-candidate.command';
import type { PeoplePort } from '@replays/application/ports/people.port';
import { CandidateIsLiveError } from '@replays/domain/exceptions/candidate-is-live.error';
import { CandidateKeptBySpotlightError } from '@replays/domain/exceptions/candidate-kept-by-spotlight.error';
import { CandidateUnderwayError } from '@replays/domain/exceptions/candidate-underway.error';
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

export class WithdrawCandidateHandler
  implements
    CommandHandlerPort<WithdrawCandidateCommand, ResourceDeleted | null>
{
  constructor(
    private readonly people: PeoplePort,
    private readonly candidates: CandidateRepository,
    private readonly replays: ReplayRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: WithdrawCandidateCommand,
  ): Promise<ResourceDeleted | null> {
    const id = CandidateId.of(command.candidateId);

    try {
      const seen = await this.candidates.find(id);
      const standing = seen
        ? await this.people.standingOn(
            seen.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!seen || !standing) {
        return null;
      }

      if (!standing.mayPlan) {
        return forbiddenTo('plan');
      }

      const withdrawn = await this.transaction.inTransaction(async () => {
        const candidate = await this.candidates.locked(id);

        if (!candidate) {
          return false;
        }

        candidate.assertVersion(command.expectedVersion);

        const replays = await this.replays.ofCandidate(id);

        await this.candidates.save(
          candidate.withdraw(
            replays.some((each) => each.isUnderway),
            Attribution.of(command.actor, candidate.workspaceId),
          ),
        );

        return true;
      });

      return withdrawn ? { outcome: 'deleted' } : null;
    } catch (error) {
      if (error instanceof CandidateVersionConflictError) {
        const current = await this.candidates.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (
        error instanceof CandidateUnderwayError ||
        error instanceof CandidateIsLiveError ||
        error instanceof CandidateKeptBySpotlightError
      ) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsApplicationError(error);
    }
  }
}
