import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ProcessedEventsPort } from '@work/application/ports/processed-events.port';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const PURGE_BATCH = 1_000;

export class PurgeProcessedEvents {
  constructor(
    private readonly events: ProcessedEventsPort,
    private readonly clock: ClockPort,
  ) {}

  async purge(): Promise<number> {
    const before = new Date(this.clock.now().getTime() - RETENTION_MS);
    let purged = 0;

    for (;;) {
      const now = await this.events.purgeBefore(before, PURGE_BATCH);
      purged += now;

      if (now < PURGE_BATCH) {
        return purged;
      }
    }
  }
}
