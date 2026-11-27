import { LongPoll } from '@runs/application/services/long-poll';
import { describe, expect, it, vi } from 'vitest';

const polling = () => {
  let now = new Date('2026-11-01T12:00:00Z');
  const clock = {
    now: () => now,
    sleep: (ms: number) => {
      now = new Date(now.getTime() + ms);
      return Promise.resolve();
    },
  };

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
    const attempt = vi.fn(() => Promise.resolve(null));

    await expect(poll.polled(attempt)).resolves.toBeNull();
    expect(attempt).toHaveBeenCalledTimes(5);
  });

  it('claims nothing after it stops', async () => {
    const poll = polling();
    const attempt = vi.fn(() => Promise.resolve('run_1'));

    poll.stop();

    await expect(poll.polled(attempt)).resolves.toBeNull();
    expect(attempt).not.toHaveBeenCalled();
  });

  it('ends a poll that waits when it stops', async () => {
    const poll = polling();
    const attempt = vi.fn(() => {
      poll.stop();
      return Promise.resolve(null);
    });

    await expect(poll.polled(attempt)).resolves.toBeNull();
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
