import type { RunConnectionsPort } from '@runs/application/ports/run-connections.port';
import { RunConnection } from '@runs/domain/value-objects/run-connection.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

const PURGE_BATCH = 5_000;

export class PurgeRunConnections {
  constructor(
    private readonly connections: RunConnectionsPort,
    private readonly clock: ClockPort,
  ) {}

  async purge(): Promise<number> {
    const before = new Date(
      this.clock.now().getTime() - RunConnection.RETENTION_MS,
    );
    let purged = 0;

    for (;;) {
      const now = await this.connections.purgeBefore(before, PURGE_BATCH);
      purged += now;

      if (now < PURGE_BATCH) {
        return purged;
      }
    }
  }
}
