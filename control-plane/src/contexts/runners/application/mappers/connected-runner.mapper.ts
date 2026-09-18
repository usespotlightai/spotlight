import type { ConnectedRunnerDto } from '@runners/application/dto/connected-runner.dto';
import type { RunnerSummary } from '@runners/application/ports/runner-reader.port';

export const ConnectedRunnerMapper = {
  summaryToDto(summary: RunnerSummary, connected: boolean): ConnectedRunnerDto {
    return {
      id: summary.id,
      name: summary.name,
      harnesses: summary.harnesses,
      registeredAt: summary.registeredAt.toISOString(),
      lastSeenAt: summary.lastSeenAt?.toISOString() ?? null,
      revokedAt: summary.revokedAt?.toISOString() ?? null,
      connected,
    };
  },
};
