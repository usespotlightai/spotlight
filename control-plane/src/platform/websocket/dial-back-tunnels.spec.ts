import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import type { HttpAdapterHost } from '@nestjs/core';
import { DialBackTunnels } from '@platform/websocket/dial-back-tunnels';
import type {
  Ask,
  TunnelDirectory,
} from '@platform/websocket/tunnel-directory';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebSocketStream, WebSocket } from 'ws';

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerPort;

const ROUTE = /^\/tunnel\/([^/]+)(?:\/([^/]+))?$/;

const sharedDirectory = () => {
  const peers = new Map<string, string>();
  const streams = new Map<string, string>();
  const asks = new Map<string, Ask>();

  return (address: string): TunnelDirectory => ({
    address,
    claimPeer: async (peer) => {
      peers.set(peer, address);
    },
    renewPeer: async (peer) => {
      if ((peers.get(peer) ?? address) === address) {
        peers.set(peer, address);
      }
    },
    releasePeer: async (peer) => {
      if (peers.get(peer) === address) {
        peers.delete(peer);
      }
    },
    ownerOfPeer: async (peer) => peers.get(peer) ?? null,
    claimStream: async (stream) => {
      streams.set(stream, address);
    },
    ownerOfStream: async (stream) => streams.get(stream) ?? null,
    ask: async (owner, peer, message) => {
      const ask = asks.get(owner);
      ask?.(peer, message);
      return ask !== undefined;
    },
    onAsk: (ask) => {
      asks.set(address, ask);
    },
    stopAsking: async () => {
      asks.delete(address);
    },
  });
};

const running: { server: Server; tunnels: DialBackTunnels }[] = [];

afterEach(async () => {
  for (const { server, tunnels } of running.splice(0)) {
    await tunnels.close();
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});

const failures: Error[] = [];

afterEach(() => {
  expect(failures.splice(0)).toEqual([]);
});

const instance = async (directoryAt: (address: string) => TunnelDirectory) => {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const tunnels = new DialBackTunnels({
    route: (pathname) => {
      const matched = ROUTE.exec(pathname);
      return matched
        ? { peer: matched[1] ?? '', stream: matched[2] ?? null }
        : null;
    },
    admit: async () => true,
    refusals: {
      browser: 'browser',
      unadmitted: 'unadmitted',
      unknownStream: 'unknown stream',
      replaced: 'replaced',
      stopping: 'stopping',
    },
    logger,
    directory: directoryAt(address),
  });
  tunnels.listen({
    httpAdapter: { getHttpServer: () => server },
  } as unknown as HttpAdapterHost);
  running.push({ server, tunnels });

  return { address, tunnels };
};

const opened = (socket: WebSocket) =>
  new Promise<void>((done, failed) => {
    socket.once('open', () => done());
    socket.once('error', failed);
  });

const host = async (
  tunnelAt: string,
  dialBackAt: () => string,
): Promise<WebSocket> => {
  const tunnel = new WebSocket(
    `${tunnelAt.replace('http', 'ws')}/tunnel/host_1`,
  );
  tunnel.on('message', (data) => {
    const { stream } = JSON.parse(data.toString()) as { stream: string };
    const back = new WebSocket(
      `${dialBackAt().replace('http', 'ws')}/tunnel/host_1/${stream}`,
    );
    back.on('unexpected-response', (_request, response) =>
      failures.push(
        new Error(`The dial-back was refused with ${response.statusCode}`),
      ),
    );
    const piped = createWebSocketStream(back);
    piped.on('error', () => {});
    piped.pipe(piped);
  });
  await opened(tunnel);

  return tunnel;
};

const echoes = async (stream: Duplex | null) => {
  expect(stream).not.toBeNull();
  const answered = new Promise<string>((done) =>
    stream?.once('data', (data: Buffer) => done(data.toString())),
  );
  stream?.write('SSH-2.0-OpenSSH\r\n');
  await expect(answered).resolves.toBe('SSH-2.0-OpenSSH\r\n');
  stream?.destroy();
};

const claimed = (directory: TunnelDirectory) =>
  vi.waitFor(async () =>
    expect(await directory.ownerOfPeer('host_1')).not.toBeNull(),
  );

describe('DialBackTunnels across instances', () => {
  it('opens a stream on an instance whose tunnel is on another one', async () => {
    const at = sharedDirectory();
    const a = await instance(at);
    const b = await instance(at);
    await host(a.address, () => b.address);
    await claimed(at(a.address));

    await echoes(await b.tunnels.open('host_1', { sandboxId: 'sandbox_a' }));
  });

  it('forwards a dial-back that reaches the instance which did not ask', async () => {
    const at = sharedDirectory();
    const a = await instance(at);
    const b = await instance(at);
    await host(a.address, () => a.address);
    await claimed(at(a.address));

    await echoes(await b.tunnels.open('host_1', { sandboxId: 'sandbox_a' }));
  });

  it('opens a stream on its own tunnel when the dial-back reaches the other instance', async () => {
    const at = sharedDirectory();
    const a = await instance(at);
    const b = await instance(at);
    await host(a.address, () => b.address);
    await claimed(at(a.address));

    await echoes(await a.tunnels.open('host_1', { sandboxId: 'sandbox_a' }));
  });

  it('answers nothing when no instance has the tunnel', async () => {
    const at = sharedDirectory();
    const b = await instance(at);

    await expect(
      b.tunnels.open('host_1', { sandboxId: 'sandbox_a' }),
    ).resolves.toBeNull();
  });

  it('gives the tunnel up in the directory when it closes', async () => {
    const at = sharedDirectory();
    const a = await instance(at);
    const tunnel = await host(a.address, () => a.address);
    await claimed(at(a.address));

    tunnel.close();

    await vi.waitFor(async () =>
      expect(await at(a.address).ownerOfPeer('host_1')).toBeNull(),
    );
  });

  it('answers nothing at once when the owner of the tunnel no longer listens', async () => {
    const at = sharedDirectory();
    const b = await instance(at);
    await at('http://127.0.0.1:1').claimPeer('host_1');

    const started = Date.now();
    await expect(
      b.tunnels.open('host_1', { sandboxId: 'sandbox_a' }),
    ).resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('opens a stream on its own tunnel when the directory cannot claim the stream', async () => {
    const at = sharedDirectory();
    const a = await instance((address) => ({
      ...at(address),
      claimStream: async () => {
        throw new Error('Redis is not reachable');
      },
    }));
    await host(a.address, () => a.address);
    await vi.waitFor(async () =>
      expect(await at(a.address).ownerOfPeer('host_1')).not.toBeNull(),
    );

    await echoes(await a.tunnels.open('host_1', { sandboxId: 'sandbox_a' }));
  });

  it('answers the opens that wait when it closes', async () => {
    const at = sharedDirectory();
    const a = await instance(at);
    const tunnel = new WebSocket(
      `${a.address.replace('http', 'ws')}/tunnel/host_1`,
    );
    await opened(tunnel);
    await claimed(at(a.address));

    const waiting = a.tunnels.open('host_1', { sandboxId: 'sandbox_a' });
    await new Promise((done) => tunnel.once('message', done));
    await a.tunnels.close();

    await expect(waiting).resolves.toBeNull();
  });

  it('refuses a dial-back with 502 when the instance that waits for it cannot be reached', async () => {
    const at = sharedDirectory();
    const a = await instance(at);
    await at('http://127.0.0.1:1').claimStream('stream_1');

    const back = new WebSocket(
      `${a.address.replace('http', 'ws')}/tunnel/host_1/stream_1`,
    );
    const status = await new Promise<number | undefined>((done) =>
      back.once('unexpected-response', (_request, response) =>
        done(response.statusCode),
      ),
    );

    expect(status).toBe(502);
  });
});
