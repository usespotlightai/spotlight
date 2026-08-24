import type { ConnectedRunnerDto } from '@application/dto/connected-runner.dto';
import type { RunnerSummary } from '@application/ports/runner-reader.port';

export const ConnectedRunnerMapper = {
  summaryToDto(summary: RunnerSummary, connected: boolean): ConnectedRunnerDto {
    return {
      id: summary.id,
      alias: summary.alias,
      pool: summary.pool,
      registeredAt: summary.registeredAt.toISOString(),
      lastSeenAt: summary.lastSeenAt?.toISOString() ?? null,
      revokedAt: summary.revokedAt?.toISOString() ?? null,
      connected,
      currentRun: summary.currentRun
        ? { id: summary.currentRun.id, state: summary.currentRun.state }
        : null,
    };
  },
};
