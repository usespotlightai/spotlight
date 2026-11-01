import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { LongPoll } from '@work/application/services/long-poll';
import { describe, expect, it, vi } from 'vitest';

const polling = () => {
  let now = new Date('2026-11-01T12:00:00Z');
  const clock = {
    now: () => now,
    sleep: async (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  } as ClockPort;

  return new LongPoll(clock, 2_000);
};

describe('LongPoll', () => {
  it('tries again until it finds something', async () => {
    const poll = polling();
    const attempt = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('run_1');

    await expect(poll.polled(attempt)).resolves.toBe('run_1');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('gives nothing once the window ends', async () => {
    const poll = polling();
    const attempt = vi.fn(async () => null);

    await expect(poll.polled(attempt)).resolves.toBeNull();
    expect(attempt).toHaveBeenCalledTimes(5);
  });

  it('claims nothing after it stops', async () => {
    const poll = polling();
    const attempt = vi.fn(async () => 'run_1');

    poll.stop();

    await expect(poll.polled(attempt)).resolves.toBeNull();
    expect(attempt).not.toHaveBeenCalled();
  });

  it('ends a poll that waits when it stops', async () => {
    const poll = polling();
    const attempt = vi.fn(async () => {
      poll.stop();
      return null;
    });

    await expect(poll.polled(attempt)).resolves.toBeNull();
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
