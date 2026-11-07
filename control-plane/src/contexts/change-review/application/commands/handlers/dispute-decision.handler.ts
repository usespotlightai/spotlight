import type { DisputeDecisionCommand } from '@change-review/application/commands/dispute-decision.command';
import type { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { UnknownDecisionError } from '@change-review/domain/exceptions/unknown-decision.error';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class DisputeDecisionHandler
  implements CommandHandlerPort<DisputeDecisionCommand, void>
{
  constructor(
    private readonly access: TeamWorkAccess,
    private readonly sets: DecisionSetRepository,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: DisputeDecisionCommand): Promise<void> {
    try {
      const deciding = await this.access.task(
        command.teamId,
        command.taskId,
        command.viewerId,
      );

      if (!deciding) {
        throw new UnknownDecisionError();
      }

      const { task, by } = deciding;

      await this.transaction.inTransaction(async () => {
        const set = await this.sets.forTask(task.id);

        if (!set) {
          throw new UnknownDecisionError();
        }

        await this.sets.save(
          set.dispute({
            id: DecisionDisputeId.of(this.ids.generate()),
            decisionId: DecisionId.of(command.decisionId),
            path: FilePath.of(command.path),
            by,
            reason: command.reason,
            now: this.clock.now(),
          }),
        );
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
