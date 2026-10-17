import { AsyncLocalStorage } from 'node:async_hooks';
import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import {
  isUnauthorized,
  McpQuestionUnsupportedError,
  McpUnauthorizedError,
  sessionGone,
} from '@integrations/infrastructure/mcp/mcp-failures';
import { cappedReply } from '@integrations/infrastructure/outbound/capped-body';
import { sameHost } from '@integrations/infrastructure/outbound/followed-redirects';
import {
  type GuardedFetch,
  guardedFetch,
} from '@integrations/infrastructure/outbound/guarded-fetch';
import { MAX_ANSWER_BYTES } from '@integrations/infrastructure/outbound/http-outbound';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  type CallToolResult,
  ErrorCode,
  McpError,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type { OnModuleDestroy } from '@nestjs/common';
import {
  InjectedSecrets,
  type InjectionRequest,
} from '@secrets/application/contracts/injected-secrets.contract';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';

type Fetch = typeof globalThis.fetch;

export interface McpInjection {
  readonly connection: string | null;
  readonly secrets: readonly string[];
  readonly credentials: Credentials;
}

interface InjectedSession extends McpInjection {
  readonly server: string;
  seen: InjectedSecrets;
}

interface Session {
  readonly client: Client;
  readonly transport: StreamableHTTPClientTransport;
  asked: boolean;
  idle: NodeJS.Timeout | null;
}

const IDLE_MS = 5 * 60_000;

const ANSWERS_WITHIN_MS = 60_000;

const MAX_PAGES = 50;

const ELICITATION_METHOD = 'elicitation/create';

const NO_STREAM = 405;

const SPOTLIGHT = { name: 'spotlight', version: '1.0.0' };

const unechoedIn = (error: unknown, injected: InjectedSecrets): void => {
  if (!(error instanceof Error)) {
    return;
  }

  error.message = injected.redact(error.message);

  const { cause } = error as { cause?: unknown };

  if (cause instanceof Error) {
    cause.message = injected.redact(cause.message);
  }
};

export class McpSessions implements OnModuleDestroy {
  readonly #idle = new Map<string, Session[]>();
  readonly #busy = new Set<Session>();
  readonly #injected = new AsyncLocalStorage<InjectedSession>();
  readonly #fetch: GuardedFetch;

  constructor(
    policy: OutboundPolicy,
    fetch: Fetch = globalThis.fetch,
    private readonly idleMs = IDLE_MS,
  ) {
    const guarded = guardedFetch(fetch, policy, (hop, request) =>
      this.inject(hop.url, request),
    );

    this.#fetch = async (url, init) => {
      const method = init?.method ?? 'GET';

      if (method === 'GET') {
        return new Response(null, { status: NO_STREAM });
      }

      const reply = await guarded(url, init);

      return cappedReply(
        reply,
        MAX_ANSWER_BYTES,
        () =>
          new UpstreamError(
            `reading what ${new URL(url.toString()).host} answered`,
            `it is larger than the ${MAX_ANSWER_BYTES / 1024 / 1024} MB Spotlight reads from a tool`,
          ),
      );
    };
  }

  tools(server: string, injection: McpInjection): Promise<readonly Tool[]> {
    const injected: InjectedSession = {
      ...injection,
      server,
      seen: InjectedSecrets.none(),
    };

    return this.#injected.run(injected, () =>
      this.unechoed(injected, () => this.listing(server)),
    );
  }

  call(
    key: string,
    server: string,
    tool: string,
    args: Readonly<Record<string, unknown>>,
    injection: McpInjection,
  ): Promise<CallToolResult> {
    const pool = `${server} ${key}`;

    const injected: InjectedSession = {
      ...injection,
      server,
      seen: InjectedSecrets.none(),
    };

    return this.#injected.run(injected, async () =>
      this.unechoed(injected, () => this.calling(pool, server, tool, args)),
    );
  }

  private async listing(server: string): Promise<readonly Tool[]> {
    let session: Session | null = null;

    try {
      session = await this.connected(server);

      const tools: Tool[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < MAX_PAGES; page += 1) {
        const listed = await session.client.listTools(
          cursor ? { cursor } : undefined,
          { timeout: ANSWERS_WITHIN_MS },
        );

        tools.push(...listed.tools);
        cursor = listed.nextCursor;

        if (!cursor) {
          break;
        }
      }

      return tools;
    } catch (error) {
      throw isUnauthorized(error) ? new McpUnauthorizedError(server) : error;
    } finally {
      if (session) {
        await this.closed(session);
      }
    }
  }

  private async calling(
    pool: string,
    server: string,
    tool: string,
    args: Readonly<Record<string, unknown>>,
  ): Promise<CallToolResult> {
    try {
      return await this.callOn(
        pool,
        await this.taken(pool, server),
        tool,
        args,
      );
    } catch (error) {
      if (!sessionGone(error)) {
        throw this.unauthorizedOr(server, error);
      }

      try {
        return await this.callOn(
          pool,
          await this.connected(server),
          tool,
          args,
        );
      } catch (again) {
        throw this.unauthorizedOr(server, again);
      }
    }
  }

  private async unechoed<T>(
    injected: InjectedSession,
    answering: () => Promise<T>,
  ): Promise<T> {
    try {
      const answer = await answering();

      return injected.seen.redactedIn(answer) as T;
    } catch (error) {
      if (!injected.seen.isEmpty) {
        unechoedIn(error, injected.seen);
      }

      throw error;
    }
  }

  onModuleDestroy(): void {
    for (const session of [...this.#idle.values()].flat()) {
      void this.closed(session);
    }

    for (const session of this.#busy) {
      void this.closed(session);
    }

    this.#idle.clear();
    this.#busy.clear();
  }

  private async callOn(
    pool: string,
    session: Session,
    tool: string,
    args: Readonly<Record<string, unknown>>,
  ): Promise<CallToolResult> {
    this.#busy.add(session);
    session.asked = false;

    let reusable = false;

    try {
      const result = (await session.client.callTool(
        { name: tool, arguments: { ...args } },
        undefined,
        { timeout: ANSWERS_WITHIN_MS },
      )) as CallToolResult;

      reusable = true;

      if (result.isError && session.asked) {
        throw new McpQuestionUnsupportedError();
      }

      return result;
    } catch (error) {
      reusable = error instanceof McpError;

      throw session.asked ? new McpQuestionUnsupportedError() : error;
    } finally {
      this.#busy.delete(session);

      if (reusable) {
        this.returned(pool, session);
      } else {
        void this.closed(session);
      }
    }
  }

  private async taken(pool: string, server: string): Promise<Session> {
    const idle = this.#idle.get(pool)?.pop();

    if (!idle) {
      return this.connected(server);
    }

    if (idle.idle) {
      clearTimeout(idle.idle);
      idle.idle = null;
    }

    return idle;
  }

  private returned(pool: string, session: Session): void {
    const idle = this.#idle.get(pool) ?? [];

    idle.push(session);
    this.#idle.set(pool, idle);
    session.idle = setTimeout(() => this.evict(pool, session), this.idleMs);
    session.idle.unref();
  }

  private evict(pool: string, session: Session): void {
    const idle = this.#idle.get(pool) ?? [];
    const at = idle.indexOf(session);

    if (at < 0) {
      return;
    }

    idle.splice(at, 1);

    if (idle.length === 0) {
      this.#idle.delete(pool);
    }

    void this.closed(session);
  }

  private async connected(server: string): Promise<Session> {
    const client = new Client(SPOTLIGHT, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(new URL(server), {
      fetch: this.#fetch,
    });
    const session: Session = { client, transport, asked: false, idle: null };

    client.fallbackRequestHandler = async (request) => {
      if (request.method === ELICITATION_METHOD) {
        session.asked = true;
      }

      throw new McpError(
        ErrorCode.MethodNotFound,
        `Spotlight does not answer ${request.method}`,
      );
    };

    try {
      await client.connect(transport, { timeout: ANSWERS_WITHIN_MS });
    } catch (error) {
      await client.close();
      throw error;
    }

    return session;
  }

  private async closed(session: Session): Promise<void> {
    if (session.idle) {
      clearTimeout(session.idle);
      session.idle = null;
    }

    await session.transport.terminateSession().catch(() => {});
    await session.client.close().catch(() => {});
  }

  private unauthorizedOr(server: string, error: unknown): unknown {
    return isUnauthorized(error) ? new McpUnauthorizedError(server) : error;
  }

  private async inject(
    url: string,
    request: InjectionRequest,
  ): Promise<InjectedSecrets> {
    const injected = this.#injected.getStore();

    if (!injected || !sameHost(url, injected.server)) {
      return InjectedSecrets.none();
    }

    if (injected.connection) {
      request.headers.authorization = `Bearer ${injected.connection}`;
    }

    if (injected.secrets.length === 0) {
      return InjectedSecrets.none();
    }

    const secrets = await injected.credentials.injectedFor(
      url,
      injected.secrets,
    );
    secrets.applyTo(request);
    injected.seen = secrets;

    return secrets;
  }
}
