import type {
  HostDto,
  LiveRunnerDto,
} from '@runners/application/dto/runner-fleet.dto';
import type {
  HostSummary,
  LiveRunnerSummary,
} from '@runners/application/ports/runner-reader.port';

export const RunnerFleetMapper = {
  host(summary: HostSummary, answering: boolean): HostDto {
    return {
      id: summary.id,
      name: summary.name,
      through: summary.through,
      release: summary.release,
      executor: summary.executor,
      capacity: summary.capacity,
      running: summary.running,
      harnesses: summary.harnesses,
      firstSeenAt: summary.firstSeenAt.toISOString(),
      lastSeenAt: summary.lastSeenAt.toISOString(),
      answering,
    };
  },

  runner(summary: LiveRunnerSummary): LiveRunnerDto {
    return {
      id: summary.id,
      through: summary.through,
      hostId: summary.hostId,
      harnesses: summary.harnesses,
      startedAt: summary.startedAt.toISOString(),
      lastSeenAt: summary.lastSeenAt?.toISOString() ?? null,
    };
  },
};
