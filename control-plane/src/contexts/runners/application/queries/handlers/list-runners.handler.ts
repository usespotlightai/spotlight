import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { ConnectedRunnerDto } from '@runners/application/dto/connected-runner.dto';
import { ConnectedRunnerMapper } from '@runners/application/mappers/connected-runner.mapper';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import type { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const SILENT_FOR_TOO_LONG_MS = 45_000;

export class ListRunnersHandler
  implements QueryHandlerPort<ListRunnersQuery, ConnectedRunnerDto[] | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly runners: RunnerReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: ListRunnersQuery): Promise<ConnectedRunnerDto[] | null> {
    try {
      const membership = await this.access.inWorkspace(
        query.slug,
        UserId.of(query.viewerId),
      );

      if (!membership) {
        return null;
      }

      const now = this.clock.now().getTime();
      const found = await this.runners.inWorkspace(membership.workspaceId);

      return found.map((runner) =>
        ConnectedRunnerMapper.summaryToDto(
          runner,
          runner.lastSeenAt !== null &&
            runner.revokedAt === null &&
            now - runner.lastSeenAt.getTime() <= SILENT_FOR_TOO_LONG_MS,
        ),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
