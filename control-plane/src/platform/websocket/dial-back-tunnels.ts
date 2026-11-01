import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { HttpAdapterHost } from '@nestjs/core';
import type { TunnelDirectory } from '@platform/websocket/tunnel-directory';
import {
  forwardedUpgrade,
  forwardUpgrade,
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
  readonly directory: TunnelDirectory;
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
  private readonly directory: TunnelDirectory;

  constructor(private readonly options: DialBackTunnelsOptions) {
    this.directory = options.directory;
  }

  listen(adapters: HttpAdapterHost): void {
    this.directory.onAsk((peer, message) => {
      const socket = this.openPeer(peer);

      if (!socket) {
        this.options.logger.warn(
          { peer },
          'An instance asked for a stream of a tunnel that is not open here',
        );
        return;
      }

      socket.send(JSON.stringify(message));
    });

    listenForUpgrades(adapters, (request, socket, head) => {
      const route = this.options.route(upgradeUrl(request).pathname);

      if (route) {
        void this.upgrade(request, socket, head, route);
      }
    });
  }

  async close(): Promise<void> {
    for (const each of this.pending.values()) {
      clearTimeout(each.timer);
      each.answer(null);
    }
    this.pending.clear();
    const peers = [...this.peers.keys()];
    for (const peer of this.peers.values()) {
      peer.close(1001, this.options.refusals.stopping);
    }
    this.sockets.close();
    await Promise.allSettled([
      this.directory.stopAsking(),
      ...peers.map((peer) => this.directory.releasePeer(peer)),
    ]);
  }

  async open(
    peer: string,
    message: Readonly<Record<string, unknown>>,
  ): Promise<Duplex | null> {
    const local = this.openPeer(peer);
    const owner = local ? null : await this.ownerOf(peer);

    if (!local && !owner) {
      return null;
    }

    const stream = randomUUID();
    const answered = new Promise<Duplex | null>((answer) => {
      const timer = setTimeout(() => {
        this.pending.delete(stream);
        answer(null);
      }, DIAL_BACK_MS);
      timer.unref();
      this.pending.set(stream, { peer, answer, timer });
    });
    const asked = { ...message, stream };

    try {
      if (local) {
        await this.directory
          .claimStream(stream)
          .catch((error: unknown) =>
            this.options.logger.warn(
              { peer, error },
              'Could not claim a stream',
            ),
          );
        await new Promise<void>((sent, failed) =>
          local.send(JSON.stringify(asked), (error) =>
            error ? failed(error) : sent(),
          ),
        );
      } else if (owner) {
        await this.directory.claimStream(stream);

        if (!(await this.directory.ask(owner, peer, asked))) {
          this.settle(stream, null);
        }
      }
    } catch (error) {
      this.options.logger.warn({ peer, error }, 'Could not ask for a stream');
      this.settle(stream, null);
    }

    return answered;
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

    if (stream !== null && !this.pending.has(stream)) {
      const owner = forwardedUpgrade(request)
        ? null
        : await this.directory.ownerOfStream(stream).catch(() => null);

      if (owner && owner !== this.directory.address) {
        forwardUpgrade(request, socket, head, owner);
        return;
      }
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

  private openPeer(peer: string): WebSocket | undefined {
    const socket = this.peers.get(peer);

    return socket && socket.readyState === socket.OPEN ? socket : undefined;
  }

  private async ownerOf(peer: string): Promise<string | null> {
    const owner = await this.directory.ownerOfPeer(peer).catch(() => null);

    return owner === this.directory.address ? null : owner;
  }

  private settle(stream: string, answer: Duplex | null): void {
    const waiting = this.pending.get(stream);

    if (waiting) {
      this.pending.delete(stream);
      clearTimeout(waiting.timer);
      waiting.answer(answer);
    }
  }

  private claim(peer: string): void {
    this.directory
      .claimPeer(peer)
      .catch((error: unknown) =>
        this.options.logger.warn({ peer, error }, 'Could not claim a tunnel'),
      );
  }

  private opened(peer: string, websocket: WebSocket): void {
    const before = this.peers.get(peer);
    this.peers.set(peer, websocket);
    before?.close(TUNNEL_CLOSE.replaced, this.options.refusals.replaced);
    this.claim(peer);

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
      this.directory
        .renewPeer(peer)
        .catch((error: unknown) =>
          this.options.logger.warn({ peer, error }, 'Could not renew a tunnel'),
        );
    });
    websocket.on('close', () => {
      clearInterval(ping);
      if (this.peers.get(peer) === websocket) {
        this.peers.delete(peer);
        void this.directory.releasePeer(peer).catch(() => undefined);
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
