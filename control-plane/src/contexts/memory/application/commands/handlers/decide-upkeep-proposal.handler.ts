import type { DecideUpkeepProposalCommand } from '@memory/application/commands/decide-upkeep-proposal.command';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import { UnknownUpkeepError } from '@memory/domain/exceptions/unknown-upkeep.error';
import type { MemoryUpkeepRepository } from '@memory/domain/repositories/memory-upkeep.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class DecideUpkeepProposalHandler implements CommandHandlerPort<
  DecideUpkeepProposalCommand,
  void
> {
  constructor(
    private readonly access: MemoryAccess,
    private readonly upkeeps: MemoryUpkeepRepository,
    private readonly memories: MemoryRepository,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: DecideUpkeepProposalCommand): Promise<void> {
    try {
      const access = await this.access.forTeam(
        TeamId.of(command.teamId),
        UserId.of(command.viewerId),
      );

      await this.transaction.inTransaction(async () => {
        const upkeep = await this.upkeeps.find(
          MemoryUpkeepId.of(command.upkeepId),
        );

        if (
          !upkeep ||
          !upkeep.teamId.equals(access.teamId) ||
          !upkeep.workspaceId.equals(access.workspaceId)
        ) {
          throw new UnknownUpkeepError(command.upkeepId);
        }

        const proposalId = UpkeepProposalId.of(command.proposalId);
        const decision = MemoryDecision.of({
          by: access.by,
          at: this.clock.now(),
        });

        if (command.decision === 'reject') {
          await this.upkeeps.save(upkeep.reject(proposalId, decision));
          return;
        }

        const proposal = upkeep.proposal(proposalId);
        await this.upkeeps.save(
          upkeep.approve({
            proposalId,
            decision,
            newMemoryId: () => MemoryId.of(this.ids.generate()),
            current: await this.memories.findAll(proposal.memories),
          }),
        );
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
