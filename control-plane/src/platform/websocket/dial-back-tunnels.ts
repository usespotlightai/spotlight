import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { HttpAdapterHost } from '@nestjs/core';
import {
  listenForUpgrades,
  refuseUpgrade,
  upgradeUrl,
} from '@platform/websocket/upgrades';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { createWebSocketStream, type WebSocket, WebSocketServer } from 'ws';

const PING_MS = 30_000;

const DIAL_BACK_MS = 30_000;

const MAX_MESSAGE_BYTES = 4 * 1024 * 1024;

const TUNNEL_CLOSE = {
  replaced: 4409,
  unknownStream: 4404,
} as const;

export interface TunnelRoute {
  readonly peer: string;
  readonly stream: string | null;
}

interface TunnelRefusals {
  readonly browser: string;
  readonly unadmitted: string;
  readonly unknownStream: string;
  readonly replaced: string;
  readonly stopping: string;
}

export interface DialBackTunnelsOptions {
  readonly route: (pathname: string) => TunnelRoute | null;
  readonly admit: (request: IncomingMessage, peer: string) => Promise<boolean>;
  readonly refusals: TunnelRefusals;
  readonly logger: LoggerPort;
}

interface Pending {
  readonly peer: string;
  readonly answer: (stream: Duplex | null) => void;
  readonly timer: NodeJS.Timeout;
}

export class DialBackTunnels {
  private readonly sockets = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
  });
  private readonly peers = new Map<string, WebSocket>();
  private readonly pending = new Map<string, Pending>();

  constructor(private readonly options: DialBackTunnelsOptions) {}

  listen(adapters: HttpAdapterHost): void {
    listenForUpgrades(adapters, (request, socket, head) => {
      const route = this.options.route(upgradeUrl(request).pathname);

      if (route) {
        void this.upgrade(request, socket, head, route);
      }
    });
  }

  close(): void {
    for (const each of this.pending.values()) {
      clearTimeout(each.timer);
      each.answer(null);
    }
    this.pending.clear();
    for (const peer of this.peers.values()) {
      peer.close(1001, this.options.refusals.stopping);
    }
    this.sockets.close();
  }

  open(
    peer: string,
    message: Readonly<Record<string, unknown>>,
  ): Promise<Duplex | null> {
    const socket = this.peers.get(peer);

    if (!socket || socket.readyState !== socket.OPEN) {
      return Promise.resolve(null);
    }

    const stream = randomUUID();

    return new Promise((answer) => {
      const timer = setTimeout(() => {
        this.pending.delete(stream);
        answer(null);
      }, DIAL_BACK_MS);
      timer.unref();
      this.pending.set(stream, { peer, answer, timer });

      socket.send(JSON.stringify({ ...message, stream }), (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(stream);
          answer(null);
        }
      });
    });
  }

  private async upgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    { peer, stream }: TunnelRoute,
  ): Promise<void> {
    const { refusals, logger } = this.options;

    if (request.headers.origin) {
      refuseUpgrade(socket, 403, refusals.browser);
      return;
    }

    let admitted = false;
    try {
      admitted = await this.options.admit(request, peer);
    } catch (error) {
      logger.warn({ peer, error }, 'Could not admit a tunnel');
    }

    if (!admitted) {
      refuseUpgrade(socket, 401, refusals.unadmitted);
      return;
    }

    if (stream !== null && this.pending.get(stream)?.peer !== peer) {
      refuseUpgrade(socket, 404, refusals.unknownStream);
      return;
    }

    this.sockets.handleUpgrade(request, socket, head, (websocket) =>
      stream === null
        ? this.opened(peer, websocket)
        : this.dialedBack(stream, websocket),
    );
  }

  private opened(peer: string, websocket: WebSocket): void {
    const before = this.peers.get(peer);
    this.peers.set(peer, websocket);
    before?.close(TUNNEL_CLOSE.replaced, this.options.refusals.replaced);

    let alive = true;
    const ping = setInterval(() => {
      if (!alive) {
        websocket.terminate();
        return;
      }
      alive = false;
      websocket.ping();
    }, PING_MS);
    ping.unref();

    websocket.on('pong', () => {
      alive = true;
    });
    websocket.on('close', () => {
      clearInterval(ping);
      if (this.peers.get(peer) === websocket) {
        this.peers.delete(peer);
      }
    });
    websocket.on('error', (error) =>
      this.options.logger.warn({ peer, error }, 'A tunnel failed'),
    );

    this.options.logger.info({ peer }, 'A tunnel opened');
  }

  private dialedBack(stream: string, websocket: WebSocket): void {
    const waiting = this.pending.get(stream);

    if (!waiting) {
      websocket.close(
        TUNNEL_CLOSE.unknownStream,
        this.options.refusals.unknownStream,
      );
      return;
    }

    this.pending.delete(stream);
    clearTimeout(waiting.timer);
    websocket.on('error', (error) =>
      this.options.logger.warn(
        { peer: waiting.peer, error },
        'A dialed-back stream failed',
      ),
    );
    waiting.answer(createWebSocketStream(websocket));
  }
}
