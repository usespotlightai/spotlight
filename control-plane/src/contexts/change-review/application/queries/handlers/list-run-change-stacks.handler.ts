import type { RunChangeStacksDto } from '@change-review/application/dto/change-stack.dto';
import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { ListRunChangeStacksQuery } from '@change-review/application/queries/list-run-change-stacks.query';
import type { ChangeStackAccess } from '@change-review/application/services/change-stack-access.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListRunChangeStacksHandler
  implements
    QueryHandlerPort<ListRunChangeStacksQuery, RunChangeStacksDto | null>
{
  constructor(
    private readonly access: ChangeStackAccess,
    private readonly stacks: ChangeStackReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    query: ListRunChangeStacksQuery,
  ): Promise<RunChangeStacksDto | null> {
    try {
      const run = await this.access.ofRun(
        query.teamId,
        query.runId,
        query.viewerId,
      );

      return run
        ? { stacks: await this.stacks.ofRun(run.id, this.clock.now()) }
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
