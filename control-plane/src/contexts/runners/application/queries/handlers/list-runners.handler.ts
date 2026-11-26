import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerFleetDto } from '@runners/application/dto/runner-fleet.dto';
import { RunnerFleetMapper } from '@runners/application/mappers/runner-fleet.mapper';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import type { WorkingCopyImagesPort } from '@runners/application/ports/working-copy-images.port';
import type { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { HostSlotHolders } from '@runners/domain/services/host-slot-holders';
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
    private readonly images: WorkingCopyImagesPort,
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
      const [hosts, runners, alive, readyToRun] = await Promise.all([
        this.runners.hostsIn(
          membership.workspaceId,
          RunnerHost.staleBefore(now),
        ),
        this.runners.inWorkspace(membership.workspaceId),
        this.runnerRepository.aliveInWorkspace(membership.workspaceId, now),
        this.runners.readyToRun(membership.workspaceId),
      ]);
      const aliveIds = new Set(alive.map((each) => each.id.value));
      const idleSandboxes = await this.runners.idleSandboxesOn(
        hosts.map((host) => host.id),
      );
      const lastRanIn = await this.images.lastRanIn(
        membership.workspaceId,
        idleSandboxes.flatMap((each) =>
          each.warmLineId === null && each.key !== null ? [each.key] : [],
        ),
      );
      const onHosts = hosts.map((host) => {
        const idle = idleSandboxes.filter((each) => each.hostId === host.id);
        const held = HostSlotHolders.on(
          HostId.of(host.id),
          alive,
          idle.map((each) => SandboxId.of(each.id)),
          now,
        );

        return { host, idle, held };
      });
      const unlisted = new Set(
        alive
          .filter((each) => onHosts.some(({ held }) => held.hides(each)))
          .map((each) => each.id.value),
      );

      return {
        hosts: onHosts.map(({ host, idle, held }) =>
          RunnerFleetMapper.host(
            host,
            RunnerHost.isOnline(host.lastHeartbeatAt, now),
            {
              slotsTaken: held.taken,
              slotsOffered: held.freeIn(host.capacity),
              idleSandboxes: idle.filter((each) =>
                held.idleSandboxes.some((shown) => shown.value === each.id),
              ),
              lastRanIn,
            },
          ),
        ),
        runners: runners
          .filter((each) => aliveIds.has(each.id) && !unlisted.has(each.id))
          .map((each) => RunnerFleetMapper.runner(each)),
        readyToRun,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
