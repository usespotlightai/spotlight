import type {
  HostDto,
  LiveRunnerDto,
} from '@runners/application/dto/runner-fleet.dto';
import type {
  HostSummary,
  LiveRunnerSummary,
} from '@runners/application/ports/runner-reader.port';

export const RunnerFleetMapper = {
  host(summary: HostSummary, online: boolean): HostDto {
    return {
      id: summary.id,
      name: summary.name,
      through: summary.through,
      release: summary.release,
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
      through: summary.through,
      hostId: summary.hostId,
      image: summary.image,
      harnesses: summary.harnesses,
      startedAt: summary.startedAt.toISOString(),
      lastHeartbeatAt: summary.lastHeartbeatAt?.toISOString() ?? null,
    };
  },
};
