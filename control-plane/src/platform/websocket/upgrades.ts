import { type IncomingMessage, STATUS_CODES } from 'node:http';
import { connect } from 'node:net';
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

const FORWARDED_HEADER = 'spotlight-forwarded';
const FORWARD_CONNECT_MS = 5_000;

export const forwardedUpgrade = (request: IncomingMessage): boolean =>
  request.headers[FORWARDED_HEADER] !== undefined;

const requestHead = (request: IncomingMessage): string => {
  const lines = [
    `${request.method} ${request.url} HTTP/${request.httpVersion}`,
  ];

  for (let at = 0; at < request.rawHeaders.length; at += 2) {
    const name = request.rawHeaders[at] ?? '';

    if (name.toLowerCase() !== FORWARDED_HEADER) {
      lines.push(`${name}: ${request.rawHeaders[at + 1]}`);
    }
  }
  lines.push(`${FORWARDED_HEADER}: 1`);

  return `${lines.join('\r\n')}\r\n\r\n`;
};

export const forwardUpgrade = (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  address: string,
): void => {
  if (socket.destroyed) {
    return;
  }

  const target = new URL(address);
  let connected = false;
  const upstream = connect(Number(target.port || 80), target.hostname, () => {
    connected = true;
    upstream.setTimeout(0);
    upstream.write(requestHead(request));
    if (head.length > 0) {
      upstream.write(head);
    }
    socket.pipe(upstream).pipe(socket);
  });

  const unreachable = () => {
    upstream.destroy();
    if (!connected) {
      refuseUpgrade(
        socket,
        502,
        'Another Spotlight instance cannot be reached.',
      );
    }
  };

  upstream.setTimeout(FORWARD_CONNECT_MS, unreachable);
  upstream.on('error', unreachable);
  upstream.on('close', () => {
    if (connected) {
      socket.destroy();
    }
  });
  socket.on('error', () => upstream.destroy());
  socket.on('close', () => upstream.destroy());
};
