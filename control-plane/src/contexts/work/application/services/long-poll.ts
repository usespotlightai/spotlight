import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

const POLL_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 500;

export const longPolled = async <T>(
  clock: ClockPort,
  attempt: () => Promise<T | null>,
): Promise<T | null> => {
  const deadline = clock.now().getTime() + POLL_TIMEOUT_MS;

  for (;;) {
    const found = await attempt();

    if (found || clock.now().getTime() >= deadline) {
      return found;
    }

    await clock.sleep(POLL_INTERVAL_MS);
  }
};
