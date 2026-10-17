import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { HeardHappeningsPort } from '@work/application/ports/heard-happenings.port';

const KEPT_FOR_MS = 30 * 24 * 60 * 60 * 1000;

const PURGE_BATCH = 1_000;

export class PurgeHeardHappenings {
  constructor(
    private readonly heard: HeardHappeningsPort,
    private readonly clock: ClockPort,
  ) {}

  async purge(): Promise<number> {
    const before = new Date(this.clock.now().getTime() - KEPT_FOR_MS);
    let purged = 0;

    for (;;) {
      const now = await this.heard.purgeBefore(before, PURGE_BATCH);
      purged += now;

      if (now < PURGE_BATCH) {
        return purged;
      }
    }
  }
}
