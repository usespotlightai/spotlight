import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { bearerIn } from '@platform/http/bearer';
import { API_PREFIX, SANDBOX_CONNECT } from '@platform/http/routes';
import {
  listenForUpgrades,
  refuseUpgrade,
  sameOrigin,
  upgradeUrl,
} from '@platform/websocket/upgrades';
import type { EditorConnectionDto } from '@runners/application/dto/sandbox-editor.dto';
import { SandboxEditors } from '@runners/application/services/sandbox-editors.service';
import { EditorSession } from '@runners/presentation/websocket/editor-session';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  type AuthenticatedUser,
  SESSION_READER,
  type SessionReaderPort,
} from '@shared-kernel/application/ports/session.port';
import { WebSocketServer } from 'ws';

const CONNECT_PATH = `/${API_PREFIX}/${SANDBOX_CONNECT}`;

const MAX_MESSAGE_BYTES = 4 * 1024 * 1024;

const ticketOf = (url: URL): EditorConnectionDto | null => {
  const sandboxId = url.searchParams.get('sandbox')?.trim() ?? '';
  const holder = url.searchParams.get('holder')?.trim() ?? '';

  return sandboxId && holder ? { sandboxId, holder } : null;
};

@Injectable()
export class SandboxEditorGateway
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly sockets = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
  });
  private readonly sessions = new Set<EditorSession>();
  private readonly connected = new Set<string>();

  constructor(
    private readonly adapters: HttpAdapterHost,
    private readonly editors: SandboxEditors,
    @Inject(SESSION_READER) private readonly people: SessionReaderPort,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    listenForUpgrades(this.adapters, (request, socket, head) => {
      if (upgradeUrl(request).pathname === CONNECT_PATH) {
        void this.connect(request, socket, head);
      }
    });
  }

  beforeApplicationShutdown(): void {
    for (const session of this.sessions) {
      session.close(1001, 'Spotlight restarts. Please connect again.');
    }
    this.sockets.close();
  }

  private async connect(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    if (!sameOrigin(request)) {
      refuseUpgrade(
        socket,
        403,
        'A page of another site cannot open a sandbox.',
      );
      return;
    }

    const held = ticketOf(upgradeUrl(request));

    if (!held) {
      refuseUpgrade(
        socket,
        400,
        'Name a sandbox and a holder: ?sandbox=<id>&holder=<holder>.',
      );
      return;
    }

    const person = await this.personOf(request);

    if (!person) {
      refuseUpgrade(
        socket,
        401,
        'Your session is missing or expired. Please sign in, or run spotlight login.',
      );
      return;
    }

    if (this.connected.has(held.holder)) {
      refuseUpgrade(
        socket,
        409,
        `The editor lease ${held.holder} has a socket already. Please connect again.`,
      );
      return;
    }

    this.connected.add(held.holder);

    let admitted: boolean;
    try {
      admitted = await this.editors.admits(held);
    } catch (error) {
      this.connected.delete(held.holder);
      this.logger.warn(
        { sandboxId: held.sandboxId, error },
        'Could not read the editor lease of a sandbox',
      );
      refuseUpgrade(
        socket,
        503,
        'Sorry, the sandbox could not be opened. Please try again.',
      );
      return;
    }

    if (!admitted) {
      this.connected.delete(held.holder);
      refuseUpgrade(
        socket,
        404,
        `No editor lease ${held.holder} on sandbox ${held.sandboxId}. Please connect again.`,
      );
      return;
    }

    if (!socket.writable) {
      this.connected.delete(held.holder);
      socket.destroy();
      await this.editors.release(held).catch(() => {});
      return;
    }

    let upgraded = false;
    socket.once('close', () => {
      if (!upgraded) {
        this.connected.delete(held.holder);
        void this.editors.release(held).catch(() => {});
      }
    });

    this.sockets.handleUpgrade(request, socket, head, (websocket) => {
      upgraded = true;
      const session = new EditorSession(
        websocket,
        held,
        this.editors,
        this.logger,
      );
      this.sessions.add(session);
      void session.run().finally(() => {
        this.sessions.delete(session);
        this.connected.delete(held.holder);
      });
    });
  }

  private async personOf(
    request: IncomingMessage,
  ): Promise<AuthenticatedUser | null> {
    const authorization = request.headers.authorization;
    const bearer = bearerIn(
      typeof authorization === 'string' ? authorization : undefined,
    );

    try {
      return bearer
        ? await this.people.readBearer(bearer)
        : await this.people.read(request.headers);
    } catch (error) {
      this.logger.warn({ error }, 'Could not read the session of an editor');
      return null;
    }
  }
}
