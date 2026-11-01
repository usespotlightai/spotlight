import { Instance } from '@platform/cluster/instance';
import { Leadership, type LeaseStore } from '@platform/redis/leadership';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { describe, expect, it, vi } from 'vitest';

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerPort;

const leading = (store: LeaseStore | null) => {
  let now = 0;
  const leadership = new Leadership(
    store,
    new Instance('http://10.0.0.2:3000'),
    logger,
    () => now,
  );

  return {
    leadership,
    elapse: (ms: number) => {
      now += ms;
    },
  };
};

describe('Leadership', () => {
  it('leads alone when there is no lease store', () => {
    expect(leading(null).leadership.held()).toBe(true);
  });

  it('leads once the store grants the lease, and not before', async () => {
    const { leadership } = leading({ eval: async () => 1 });

    expect(leadership.held()).toBe(false);
    await leadership.renew();
    expect(leadership.held()).toBe(true);
  });

  it('does not lead while another instance holds the lease', async () => {
    const { leadership } = leading({ eval: async () => 0 });

    await leadership.renew();

    expect(leadership.held()).toBe(false);
  });

  it('stops leading before the lease can expire when renewals stall', async () => {
    const answers = [Promise.resolve(1), new Promise<number>(() => {})];
    const store = { eval: vi.fn(async () => answers.shift()) };
    const { leadership, elapse } = leading(store);
    await leadership.renew();

    void leadership.renew();
    void leadership.renew();
    elapse(25_000);

    expect(leadership.held()).toBe(false);
    expect(store.eval).toHaveBeenCalledTimes(2);
  });

  it('keeps leading through a failed renewal until its deadline', async () => {
    const answers = [
      Promise.resolve(1),
      Promise.reject(new Error('Redis is not reachable')),
    ];
    const { leadership, elapse } = leading({
      eval: () => answers.shift() as Promise<unknown>,
    });
    await leadership.renew();

    await leadership.renew();
    elapse(10_000);

    expect(leadership.held()).toBe(true);
  });

  it('gives the lease back when it stops', async () => {
    const store = { eval: vi.fn(async () => 1) };
    const { leadership } = leading(store);
    await leadership.renew();

    await leadership.beforeApplicationShutdown();

    expect(leadership.held()).toBe(false);
    expect(store.eval).toHaveBeenLastCalledWith(
      expect.stringContaining("'del'"),
      1,
      'spotlight:leader',
      expect.any(String),
    );
  });
});
