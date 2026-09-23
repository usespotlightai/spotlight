import type { DisputeDecisionCommand } from '@change-review/application/commands/dispute-decision.command';
import type { TaskDecisionsDto } from '@change-review/application/dto/decision.dto';
import { namedDisputes } from '@change-review/application/mappers/named-disputes';
import type { DecisionReaderPort } from '@change-review/application/ports/decision-reader.port';
import type { PeoplePort } from '@change-review/application/ports/people.port';
import type { DecisionAccess } from '@change-review/application/services/decision-access.service';
import { UnknownDecisionError } from '@change-review/domain/exceptions/unknown-decision.error';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class DisputeDecisionHandler
  implements CommandHandlerPort<DisputeDecisionCommand, TaskDecisionsDto>
{
  constructor(
    private readonly access: DecisionAccess,
    private readonly sets: DecisionSetRepository,
    private readonly decisions: DecisionReaderPort,
    private readonly people: PeoplePort,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: DisputeDecisionCommand): Promise<TaskDecisionsDto> {
    try {
      const deciding = await this.access.ofTask(
        command.teamId,
        command.taskId,
        command.viewerId,
      );

      if (!deciding) {
        throw new UnknownDecisionError();
      }

      const { task, by } = deciding;

      await this.transaction.run(async () => {
        const set = await this.sets.forTask(task.id);

        if (!set) {
          throw new UnknownDecisionError();
        }

        await this.sets.save(
          set.disputed({
            id: DecisionDisputeId.of(this.ids.generate()),
            decisionId: DecisionId.of(command.decisionId),
            path: FilePath.of(command.path),
            by,
            reason: command.reason,
            now: this.clock.now(),
          }),
        );
      });

      const found = await this.decisions.ofTask(task.id);

      if (!found) {
        throw new UnknownDecisionError();
      }

      return {
        ...found,
        decisions: await namedDisputes(found.decisions, this.people),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
