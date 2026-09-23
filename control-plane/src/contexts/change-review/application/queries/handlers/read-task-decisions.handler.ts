import {
  NO_DECISIONS,
  type TaskDecisionsDto,
} from '@change-review/application/dto/decision.dto';
import { namedDisputes } from '@change-review/application/mappers/named-disputes';
import type { DecisionReaderPort } from '@change-review/application/ports/decision-reader.port';
import type { PeoplePort } from '@change-review/application/ports/people.port';
import type { ReadTaskDecisionsQuery } from '@change-review/application/queries/read-task-decisions.query';
import type { DecisionAccess } from '@change-review/application/services/decision-access.service';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadTaskDecisionsHandler
  implements QueryHandlerPort<ReadTaskDecisionsQuery, TaskDecisionsDto | null>
{
  constructor(
    private readonly access: DecisionAccess,
    private readonly decisions: DecisionReaderPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(
    query: ReadTaskDecisionsQuery,
  ): Promise<TaskDecisionsDto | null> {
    try {
      const deciding = await this.access.ofTask(
        query.teamId,
        query.taskId,
        query.viewerId,
      );

      if (!deciding) {
        return null;
      }

      const found = await this.decisions.ofTask(deciding.task.id);

      if (!found) {
        return NO_DECISIONS;
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
