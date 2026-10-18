import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerFleetDto } from '@runners/application/dto/runner-fleet.dto';
import { RunnerFleetMapper } from '@runners/application/mappers/runner-fleet.mapper';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import type { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListRunnersHandler
  implements QueryHandlerPort<ListRunnersQuery, RunnerFleetDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly runners: RunnerReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: ListRunnersQuery): Promise<RunnerFleetDto | null> {
    try {
      const membership = await this.access.inWorkspace(
        query.slug,
        UserId.of(query.viewerId),
      );

      if (!membership) {
        return null;
      }

      const now = this.clock.now();
      const [hosts, runners] = await Promise.all([
        this.runners.hostsIn(
          membership.workspaceId,
          RunnerHost.staleBefore(now),
        ),
        this.runners.inWorkspace(membership.workspaceId),
      ]);

      return {
        hosts: hosts.map((host) =>
          RunnerFleetMapper.host(
            host,
            RunnerHost.isOnline(host.lastHeartbeatAt, now),
          ),
        ),
        runners: runners.map(RunnerFleetMapper.runner),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
