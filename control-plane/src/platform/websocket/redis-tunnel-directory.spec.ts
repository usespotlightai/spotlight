import type { RedisPubSub } from '@platform/redis/redis-connection';
import { RedisTunnelDirectory } from '@platform/websocket/redis-tunnel-directory';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import { afterEach, describe, expect, it, vi } from 'vitest';

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerPort;

const connections: Redis[] = [];

afterEach(async () => {
  await Promise.all(
    connections.splice(0).map(async (each) => {
      await each.unsubscribe();
      await each.quit();
    }),
  );
});

const connected = (): RedisPubSub => {
  const client = new RedisMock() as unknown as Redis;
  const subscriber = client.duplicate();
  connections.push(client, subscriber);

  return { client, subscriber };
};

const directories = async () => {
  const shared = connected();
  await shared.client.flushall();

  return (address: string) => {
    const subscriber = shared.client.duplicate();
    connections.push(subscriber);

    return new RedisTunnelDirectory(
      { client: shared.client, subscriber },
      address,
      'host-tunnels',
      logger,
    );
  };
};

describe('RedisTunnelDirectory', () => {
  it('names the instance that claimed a tunnel', async () => {
    const at = await directories();

    await at('http://a:3000').claimPeer('host_1');

    await expect(at('http://b:3000').ownerOfPeer('host_1')).resolves.toBe(
      'http://a:3000',
    );
  });

  it('releases only its own claim', async () => {
    const at = await directories();
    await at('http://a:3000').claimPeer('host_1');

    await at('http://b:3000').releasePeer('host_1');
    await expect(at('http://b:3000').ownerOfPeer('host_1')).resolves.toBe(
      'http://a:3000',
    );

    await at('http://a:3000').releasePeer('host_1');
    await expect(at('http://b:3000').ownerOfPeer('host_1')).resolves.toBeNull();
  });

  it('claims a lost tunnel again on renewal but never takes another instance’s', async () => {
    const at = await directories();

    await at('http://a:3000').renewPeer('host_1');
    await at('http://b:3000').renewPeer('host_1');

    await expect(at('http://b:3000').ownerOfPeer('host_1')).resolves.toBe(
      'http://a:3000',
    );
  });

  it('names the instance that waits for a stream', async () => {
    const at = await directories();

    await at('http://b:3000').claimStream('stream_1');

    await expect(at('http://a:3000').ownerOfStream('stream_1')).resolves.toBe(
      'http://b:3000',
    );
  });

  it('hands an ask to the instance it names, and only to it', async () => {
    const at = await directories();
    const a = at('http://a:3000');
    const c = at('http://c:3000');
    const askedA = vi.fn();
    const askedC = vi.fn();
    a.onAsk(askedA);
    c.onAsk(askedC);
    await vi.waitFor(() =>
      expect(
        at('http://b:3000').ask('http://a:3000', 'host_1', {}),
      ).resolves.toBe(true),
    );

    await at('http://b:3000').ask('http://a:3000', 'host_1', {
      stream: 'stream_1',
    });

    await vi.waitFor(() =>
      expect(askedA).toHaveBeenLastCalledWith('host_1', { stream: 'stream_1' }),
    );
    expect(askedC).not.toHaveBeenCalled();
  });

  it('reports an ask that no instance received', async () => {
    const at = await directories();

    await expect(
      at('http://b:3000').ask('http://gone:3000', 'host_1', {}),
    ).resolves.toBe(false);
  });

  it('stops receiving asks', async () => {
    const at = await directories();
    const a = at('http://a:3000');
    a.onAsk(() => {});
    await vi.waitFor(() =>
      expect(
        at('http://b:3000').ask('http://a:3000', 'host_1', {}),
      ).resolves.toBe(true),
    );

    await a.stopAsking();

    await expect(
      at('http://b:3000').ask('http://a:3000', 'host_1', {}),
    ).resolves.toBe(false);
  });
});
