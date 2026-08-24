import type { ConnectedRunnerDto } from '@application/dto/connected-runner.dto';
import type { RunnerSummary } from '@application/ports/runner-reader.port';

export const ConnectedRunnerMapper = {
  summaryToDto(summary: RunnerSummary, connected: boolean): ConnectedRunnerDto {
    return {
      id: summary.id,
      pool: summary.pool,
      labels: { ...summary.labels },
      registeredAt: summary.registeredAt.toISOString(),
      lastSeenAt: summary.lastSeenAt.toISOString(),
      connected,
      currentRun: summary.currentRun
        ? { id: summary.currentRun.id, state: summary.currentRun.state }
        : null,
    };
  },
};
