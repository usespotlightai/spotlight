import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerFleetDto } from '@runners/application/dto/runner-fleet.dto';
import { RunnerFleetMapper } from '@runners/application/mappers/runner-fleet.mapper';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import type { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import { occupancyOnHost } from '@runners/application/services/pool-occupancy';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListRunnersHandler implements QueryHandlerPort<
  ListRunnersQuery,
  RunnerFleetDto | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly runners: RunnerReaderPort,
    private readonly runnerRepository: RunnerRepository,
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
      const [hosts, runners, alive] = await Promise.all([
        this.runners.hostsIn(
          membership.workspaceId,
          RunnerHost.staleBefore(now),
        ),
        this.runners.inWorkspace(membership.workspaceId),
        this.runnerRepository.aliveInWorkspace(membership.workspaceId, now),
      ]);
      const aliveIds = new Set(alive.map((each) => each.id.value));
      const idleSandboxes = await this.runners.idleSandboxesOn(
        hosts.map((host) => host.id),
      );

      return {
        hosts: hosts.map((host) => {
          const idle = idleSandboxes.filter((each) => each.hostId === host.id);

          return RunnerFleetMapper.host(
            host,
            RunnerHost.isOnline(host.lastHeartbeatAt, now),
            {
              slotsTaken: occupancyOnHost(
                HostId.of(host.id),
                alive,
                idle.map((each) => SandboxId.of(each.id)),
              ).taken,
              idleSandboxes: idle,
            },
          );
        }),
        runners: runners
          .filter((each) => aliveIds.has(each.id))
          .map((each) => RunnerFleetMapper.runner(each)),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
