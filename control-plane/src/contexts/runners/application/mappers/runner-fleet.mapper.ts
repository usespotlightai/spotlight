import { MIN_HOST_RELEASE } from '@runners/application/contracts/least-host-release.contract';
import type {
  HostDto,
  LiveRunnerDto,
} from '@runners/application/dto/runner-fleet.dto';
import type {
  HostSummary,
  LiveRunnerSummary,
} from '@runners/application/ports/runner-reader.port';
import { Release } from '@shared-kernel/domain/value-objects/release.vo';

export const RunnerFleetMapper = {
  host(summary: HostSummary, online: boolean): HostDto {
    return {
      id: summary.id,
      name: summary.name,
      source: summary.source,
      release: summary.release,
      unavailableReason: Release.published(summary.release)?.isOlderThan(
        Release.of(MIN_HOST_RELEASE),
      )
        ? `Host is on release ${summary.release}. Minimum release required: ${MIN_HOST_RELEASE}. Update it with: spotlight host update`
        : null,
      containerRuntime: summary.containerRuntime,
      capacity: summary.capacity,
      running: summary.running,
      images: summary.images,
      firstHeartbeatAt: summary.firstHeartbeatAt.toISOString(),
      onlineSince: summary.onlineSince.toISOString(),
      lastHeartbeatAt: summary.lastHeartbeatAt.toISOString(),
      online,
    };
  },

  runner(summary: LiveRunnerSummary): LiveRunnerDto {
    return {
      id: summary.id,
      source: summary.source,
      hostId: summary.hostId,
      image: summary.image,
      harnesses: summary.harnesses,
      startedAt: summary.startedAt.toISOString(),
      lastHeartbeatAt: summary.lastHeartbeatAt?.toISOString() ?? null,
    };
  },
};
