import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { OutboundCalls } from '@platform/outbound/outbound-calls';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('OutboundCalls', () => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const calls = new OutboundCalls(logger);
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    server = createServer((req, res) => {
      res.statusCode = req.url?.startsWith('/busy') ? 429 : 200;
      res.end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    calls.onModuleInit();
  });

  afterEach(async () => {
    calls.onModuleDestroy();
    await new Promise((resolve) => server.close(resolve));
  });

  it('writes one debug line for each call, with host, method, status and duration', async () => {
    await fetch(
      `${origin}/hooks/T000/B000/secret-in-path?token=secret-in-query`,
    );

    expect(logger.debug).toHaveBeenCalledExactlyOnceWith(
      {
        outbound: {
          host: new URL(origin).host,
          method: 'GET',
          status: 200,
          durationMs: expect.any(Number),
        },
      },
      'Outbound call',
    );
    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain('secret');
  });

  it('warns when the other side refuses because of too many requests', async () => {
    await fetch(`${origin}/busy`, { method: 'POST' });

    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      {
        outbound: expect.objectContaining({ method: 'POST', status: 429 }),
      },
      'Outbound call refused',
    );
  });

  it('warns when the call does not reach the other side', async () => {
    const closed = createServer();
    await new Promise<void>((resolve) =>
      closed.listen(0, '127.0.0.1', resolve),
    );
    const { port } = closed.address() as AddressInfo;
    await new Promise((resolve) => closed.close(resolve));

    await fetch(`http://127.0.0.1:${port}/`).catch(() => undefined);

    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      {
        outbound: expect.objectContaining({ host: `127.0.0.1:${port}` }),
        err: expect.anything(),
      },
      'Outbound call failed',
    );
  });
});
