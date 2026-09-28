import { SystemClock } from '@platform/time/system-clock';
import { describe, expect, it } from 'vitest';

describe('SystemClock', () => {
  it('stops sleeping, quietly, once the wait is cancelled', async () => {
    const cancelling = new AbortController();
    const slept = new SystemClock().sleep(60_000, cancelling.signal);

    cancelling.abort();

    await expect(slept).resolves.toBeUndefined();
  });

  it('sleeps out a wait nobody cancels', async () => {
    await expect(new SystemClock().sleep(1)).resolves.toBeUndefined();
  });
});
