import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { CommandBus } from '@nestjs/cqrs';
import { bearerIn } from '@platform/http/bearer';
import { API_PREFIX, SANDBOX_CONNECT } from '@platform/http/routes';
import {
  listenForUpgrades,
  refuseUpgrade,
  sameOrigin,
  upgradeUrl,
} from '@platform/websocket/upgrades';
import { ConnectEditorCommand } from '@runners/application/commands/sandbox-editor.commands';
import type { EditorConnectionDto } from '@runners/application/dto/sandbox-editor.dto';
import type { EditorTarget } from '@runners/application/ports/editor-access.port';
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

const targetOf = (url: URL): EditorTarget | null => {
  const task = url.searchParams.get('task')?.trim() ?? '';
  const chat = url.searchParams.get('chat')?.trim() ?? '';

  if ((task === '') === (chat === '')) {
    return null;
  }

  return task ? { kind: 'task', id: task } : { kind: 'chat', id: chat };
};

@Injectable()
export class SandboxEditorGateway
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly sockets = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
  });
  private readonly sessions = new Set<EditorSession>();

  constructor(
    private readonly adapters: HttpAdapterHost,
    private readonly commandBus: CommandBus,
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

  onApplicationShutdown(): void {
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

    const url = upgradeUrl(request);
    const target = targetOf(url);

    if (!target) {
      refuseUpgrade(
        socket,
        400,
        'Name one task or one chat: ?task=<id> or ?chat=<id>.',
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

    let connection: EditorConnectionDto | null;
    try {
      connection = await this.commandBus.execute<
        ConnectEditorCommand,
        EditorConnectionDto | null
      >(
        new ConnectEditorCommand(
          person.id,
          target,
          url.searchParams.get('workspace')?.trim() || null,
        ),
      );
    } catch (error) {
      this.logger.warn(
        { target, error },
        'Could not open a sandbox for an editor',
      );
      refuseUpgrade(
        socket,
        503,
        'Sorry, the sandbox could not be opened. Please try again.',
      );
      return;
    }

    if (!connection) {
      refuseUpgrade(
        socket,
        404,
        `No ${target.kind} ${target.id} that you may open in an editor.`,
      );
      return;
    }

    const held = connection;
    if (!socket.writable) {
      socket.destroy();
      await this.editors.release(held).catch(() => {});
      return;
    }

    let upgraded = false;
    socket.once('close', () => {
      if (!upgraded) {
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
      void session.run().finally(() => this.sessions.delete(session));
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
