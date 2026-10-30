import { type IncomingMessage, STATUS_CODES } from 'node:http';
import type { Duplex } from 'node:stream';
import type { HttpAdapterHost } from '@nestjs/core';

export type UpgradeListener = (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
) => void;

export const listenForUpgrades = (
  adapters: HttpAdapterHost,
  listener: UpgradeListener,
): void => {
  const server = adapters.httpAdapter?.getHttpServer() as
    | { on(event: 'upgrade', listener: UpgradeListener): void }
    | undefined;

  server?.on('upgrade', (request, socket, head) => {
    try {
      listener(request, socket, head);
    } catch {
      refuseUpgrade(socket, 400, 'The request address is not valid.');
    }
  });
};

export const upgradeUrl = (request: IncomingMessage): URL =>
  new URL(request.url ?? '/', 'http://upgrade');

// A browser always names the page that opens a socket; only our own pages may use the session cookie here.
export const sameOrigin = (request: IncomingMessage): boolean => {
  const origin = request.headers.origin;

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
};

export const refuseUpgrade = (
  socket: Duplex,
  status: number,
  message: string,
): void => {
  if (!socket.writable) {
    socket.destroy();
    return;
  }

  const body = `${message}\n`;
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_CODES[status] ?? 'Error'}\r\n` +
      'Connection: close\r\n' +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
  );
};
