import { Agent, get, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { GracefulShutdown } from '@platform/lifecycle/graceful-shutdown';
import { describe, expect, it } from 'vitest';

import { openApp } from './support/app';

const answer = (
  port: number,
  agent: Agent,
): Promise<{ status: number; connection: string | undefined }> =>
  new Promise((resolve, reject) => {
    get({ host: '127.0.0.1', port, path: '/api/health', agent }, (response) => {
      response.resume();
      response.on('end', () =>
        resolve({
          status: response.statusCode ?? 0,
          connection: response.headers.connection,
        }),
      );
    }).on('error', reject);
  });

describe('shutdown', () => {
  it('turns away a request on a kept-alive connection once the app starts to close', async () => {
    let shuttingDown: () => void = () => undefined;
    const reachedShutdown = new Promise<void>((resolve) => {
      shuttingDown = resolve;
    });
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const app = await openApp((module) =>
      module.overrideProvider(GracefulShutdown).useValue({
        beforeApplicationShutdown: () => {
          shuttingDown();
          return released;
        },
      }),
    );
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    const agent = new Agent({ keepAlive: true, maxSockets: 1 });

    try {
      expect((await answer(port, agent)).status).toBe(200);

      const closed = app.close();
      await reachedShutdown;

      expect(await answer(port, agent)).toEqual({
        status: 503,
        connection: 'close',
      });

      release();
      await closed;
    } finally {
      release();
      agent.destroy();
    }
  });
});
