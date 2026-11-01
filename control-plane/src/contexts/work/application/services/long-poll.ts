import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

const POLL_WINDOW_MS = 10_000;
const POLL_INTERVAL_MS = 500;

export class LongPoll {
  private readonly intervalMs: number;
  #stopped = false;

  constructor(
    private readonly clock: ClockPort,
    private readonly windowMs: number = POLL_WINDOW_MS,
  ) {
    this.intervalMs = Math.min(POLL_INTERVAL_MS, windowMs);
  }

  stop(): void {
    this.#stopped = true;
  }

  deadline(): Date {
    return new Date(this.clock.now().getTime() + this.windowMs);
  }

  async polled<T>(
    attempt: () => Promise<T | null>,
    until: Date = this.deadline(),
  ): Promise<T | null> {
    const deadline = until.getTime();

    for (;;) {
      if (this.#stopped) {
        return null;
      }

      const found = await attempt();

      if (found || this.clock.now().getTime() >= deadline) {
        return found;
      }

      await this.clock.sleep(this.intervalMs);
    }
  }
}
