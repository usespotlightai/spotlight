import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ToolUsesPort } from '@work/application/ports/tool-uses.port';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const PURGE_BATCH = 5_000;

export class PurgeToolUses {
  constructor(
    private readonly uses: ToolUsesPort,
    private readonly clock: ClockPort,
  ) {}

  async purge(): Promise<number> {
    const before = new Date(this.clock.now().getTime() - RETENTION_MS);
    let purged = 0;

    for (;;) {
      const now = await this.uses.purgeBefore(before, PURGE_BATCH);
      purged += now;

      if (now < PURGE_BATCH) {
        return purged;
      }
    }
  }
}
