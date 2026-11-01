import type { IncomingMessage } from 'node:http';
import { Redis } from '@hocuspocus/extension-redis';
import { type Extension, Hocuspocus } from '@hocuspocus/server';
import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { CollabDocuments } from '@platform/collab/collab-documents';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { API_PREFIX, COLLAB } from '@platform/http/routes';
import {
  listenForUpgrades,
  sameOrigin,
  upgradeUrl,
} from '@platform/websocket/upgrades';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import type { RequestHeaders } from '@shared-kernel/application/ports/session.port';
import IORedis from 'ioredis';
import { WebSocketServer } from 'ws';
import { type Doc, encodeStateAsUpdate } from 'yjs';

const COLLAB_PATH = `/${API_PREFIX}/${COLLAB}`;

const IDLE_MS = 30_000;

const MAX_MESSAGE_BYTES = 1024 * 1024;

const MAX_DOCUMENT_BYTES = 1024 * 1024;

const SHUTDOWN_MS = 5_000;

const RECHECK_MS = 60_000;

type Admitted = { readonly headers: RequestHeaders };

class RefusedError extends Error {}

const kindOf = (name: string): { kind: string; id: string } => {
  const at = name.indexOf(':');

  return at < 0
    ? { kind: '', id: '' }
    : { kind: name.slice(0, at), id: name.slice(at + 1) };
};

const headersOf = (request: IncomingMessage): Headers => {
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    for (const each of Array.isArray(value) ? value : [value ?? '']) {
      headers.append(name, each);
    }
  }

  return headers;
};

@Injectable()
export class CollabServer
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly served = new Map<string, CollabDocuments>();
  private readonly sockets = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
  });
  private readonly hocuspocus: Hocuspocus<Admitted>;
  private recheck: NodeJS.Timeout | undefined;

  constructor(
    private readonly adapters: HttpAdapterHost,
    @Inject(ENV) env: Env,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {
    const extensions: Extension[] = env.REDIS_URL
      ? [
          new Redis({
            createClient: () => new IORedis(env.REDIS_URL ?? ''),
            prefix: 'spotlight-collab',
          }),
        ]
      : [];

    this.hocuspocus = new Hocuspocus<Admitted>({
      quiet: true,
      timeout: IDLE_MS,
      debounce: 2_000,
      maxDebounce: 10_000,
      extensions,
      onAuthenticate: async ({
        documentName,
        requestHeaders,
      }): Promise<Admitted> => {
        const { documents, id } = this.documentsOf(documentName);
        const headers = Object.fromEntries(requestHeaders);

        if (!(await documents.admit(id, headers))) {
          throw new RefusedError(documentName);
        }

        return { headers };
      },
      onLoadDocument: async ({ documentName, document }) => {
        const { documents, id } = this.documentsOf(documentName);
        await documents.load(id, document);
      },
      onStoreDocument: async ({ documentName, document }) => {
        const { documents, id } = this.documentsOf(documentName);
        const state = encodeStateAsUpdate(document);

        if (state.byteLength > MAX_DOCUMENT_BYTES) {
          this.logger.warn(
            { documentName, bytes: state.byteLength },
            'Refused to keep a shared document over the size limit',
          );
          this.hocuspocus.closeConnections(documentName);
          return;
        }

        await documents.keep(id, state);
      },
    });
  }

  serve(kind: string, documents: CollabDocuments): void {
    this.served.set(kind, documents);
  }

  async read<T>(name: string, read: (doc: Doc) => T): Promise<T> {
    const connection = await this.hocuspocus.openDirectConnection(name);

    try {
      let found: T | undefined;
      await connection.transact((doc) => {
        found = read(doc);
      });
      return found as T;
    } finally {
      await connection.disconnect();
    }
  }

  async change(name: string, change: (doc: Doc) => void): Promise<void> {
    const connection = await this.hocuspocus.openDirectConnection(name);

    try {
      await connection.transact(change);
    } finally {
      await connection.disconnect();
    }
  }

  onApplicationBootstrap(): void {
    this.recheck = setInterval(() => void this.admitAgain(), RECHECK_MS);
    this.recheck.unref();

    listenForUpgrades(this.adapters, (request, socket, head) => {
      if (upgradeUrl(request).pathname !== COLLAB_PATH) {
        return;
      }

      if (!sameOrigin(request)) {
        socket.destroy();
        return;
      }

      this.sockets.handleUpgrade(request, socket, head, (websocket) => {
        const connection = this.hocuspocus.handleConnection(
          websocket,
          new Request(new URL(request.url ?? '/', 'http://collab'), {
            headers: headersOf(request),
          }),
        );
        const ping = setInterval(() => websocket.ping(), IDLE_MS / 2);

        websocket.on('pong', () => connection.touch());
        websocket.on('message', (data: Buffer) =>
          connection.handleMessage(new Uint8Array(data)),
        );
        websocket.on('close', (code, reason) => {
          clearInterval(ping);
          connection.handleClose({ code, reason: reason.toString() });
        });
        websocket.on('error', (error) =>
          this.logger.warn({ error }, 'A shared draft connection failed'),
        );
      });
    });
  }

  async beforeApplicationShutdown(): Promise<void> {
    clearInterval(this.recheck);

    const unloaded = new Promise<void>((done) => {
      const check = () => {
        if (this.hocuspocus.getDocumentsCount() === 0) {
          done();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });

    this.hocuspocus.closeConnections();
    this.hocuspocus.flushPendingStores();
    this.sockets.close();

    await Promise.race([
      unloaded,
      new Promise((done) => setTimeout(done, SHUTDOWN_MS).unref()),
    ]);
    await this.hocuspocus.hooks('onDestroy', { instance: this.hocuspocus });
  }

  // Access can end while a socket stays open: a person leaves the workspace or their session ends.
  private async admitAgain(): Promise<void> {
    for (const document of this.hocuspocus.documents.values()) {
      for (const connection of document.getConnections()) {
        try {
          const { documents, id } = this.documentsOf(document.name);

          if (!(await documents.admit(id, connection.context.headers))) {
            connection.close();
          }
        } catch (error) {
          this.logger.warn(
            { documentName: document.name, error },
            'Could not check access to a shared document again',
          );
        }
      }
    }
  }

  private documentsOf(name: string): {
    documents: CollabDocuments;
    id: string;
  } {
    const { kind, id } = kindOf(name);
    const documents = this.served.get(kind);

    if (!documents || !id) {
      throw new RefusedError(name);
    }

    return { documents, id };
  }
}
