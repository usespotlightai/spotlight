import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunConnectionsPort } from '@work/application/ports/run-connections.port';

const KEPT_FOR_MS = 30 * 24 * 60 * 60 * 1000;

const PURGE_BATCH = 5_000;

export class PurgeRunConnections {
  constructor(
    private readonly connections: RunConnectionsPort,
    private readonly clock: ClockPort,
  ) {}

  async purge(): Promise<number> {
    const before = new Date(this.clock.now().getTime() - KEPT_FOR_MS);
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
