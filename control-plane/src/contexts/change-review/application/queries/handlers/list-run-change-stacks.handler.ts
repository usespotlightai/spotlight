import type { RunChangeStacksDto } from '@change-review/application/dto/change-stack.dto';
import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { WorkspacesPort } from '@change-review/application/ports/workspaces.port';
import type { ListRunChangeStacksQuery } from '@change-review/application/queries/list-run-change-stacks.query';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListRunChangeStacksHandler
  implements
    QueryHandlerPort<ListRunChangeStacksQuery, RunChangeStacksDto | null>
{
  constructor(
    private readonly work: WorkPort,
    private readonly workspaces: WorkspacesPort,
    private readonly stacks: ChangeStackReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    query: ListRunChangeStacksQuery,
  ): Promise<RunChangeStacksDto | null> {
    try {
      const run = await this.work.run(RunId.of(query.runId));

      if (
        !run ||
        !(await this.workspaces.mayView(
          UserId.of(query.viewerId),
          run.workspaceId,
        ))
      ) {
        return null;
      }

      return { stacks: await this.stacks.ofRun(run.id, this.clock.now()) };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
