import type { RunFactsPort } from '@outcomes/application/ports/run-facts.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { OwedWorkPort } from '@shared-kernel/application/ports/owed-work.port';

const EVERY_MS = 6 * 60 * 60_000;

const CHECKED_MS = 3 * 24 * 60 * 60_000;

const NAMED = 20;

export class CheckRunFacts implements OwedWorkPort {
  readonly name = 'Checking run facts against their runs';

  #checkedAt: number | null = null;

  constructor(
    private readonly facts: RunFactsPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async workDue(): Promise<void> {
    const now = this.clock.now().getTime();

    if (this.#checkedAt !== null && now - this.#checkedAt < EVERY_MS) {
      return;
    }

    this.#checkedAt = now;
    const drift = await this.facts.repairEndedSince(new Date(now - CHECKED_MS));

    if (drift.repaired.length > 0) {
      this.logger.warn(
        {
          checked: drift.checked,
          repaired: drift.repaired.length,
          runIds: drift.repaired.slice(0, NAMED),
        },
        'Run facts had drifted from their runs and were repaired',
      );
    }
  }
}
