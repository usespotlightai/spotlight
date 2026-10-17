import { AsyncLocalStorage } from 'node:async_hooks';
import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import {
  McpAuthorizationRefused,
  McpQuestionRefused,
  refusedAuthorization,
  sessionGone,
} from '@integrations/infrastructure/mcp/mcp-failures';
import { cappedReply } from '@integrations/infrastructure/outbound/capped-body';
import { sameHost } from '@integrations/infrastructure/outbound/followed-redirects';
import { MAX_ANSWER_BYTES } from '@integrations/infrastructure/outbound/http-outbound';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import {
  type PolicedFetch,
  policedFetch,
} from '@integrations/infrastructure/outbound/policed-fetch';
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
  type WornRequest,
  WornSecrets,
} from '@secrets/application/contracts/worn-secrets.contract';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';

type Fetch = typeof globalThis.fetch;

export interface McpWearing {
  readonly connection: string | null;
  readonly secrets: readonly string[];
  readonly credentials: Credentials;
}

interface Worn extends McpWearing {
  readonly server: string;
  seen: WornSecrets;
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

const ASKS = 'elicitation/create';

const NO_STREAM = 405;

const SPOTLIGHT = { name: 'spotlight', version: '1.0.0' };

const unechoedIn = (error: unknown, worn: WornSecrets): void => {
  if (!(error instanceof Error)) {
    return;
  }

  error.message = worn.redact(error.message);

  const { cause } = error as { cause?: unknown };

  if (cause instanceof Error) {
    cause.message = worn.redact(cause.message);
  }
};

export class McpSessions implements OnModuleDestroy {
  readonly #idle = new Map<string, Session[]>();
  readonly #busy = new Set<Session>();
  readonly #worn = new AsyncLocalStorage<Worn>();
  readonly #fetch: PolicedFetch;

  constructor(
    policy: OutboundPolicy,
    fetch: Fetch = globalThis.fetch,
    private readonly idleMs = IDLE_MS,
  ) {
    const policed = policedFetch(fetch, policy, (hop, request) =>
      this.wear(hop.url, request),
    );

    this.#fetch = async (url, init) => {
      const method = init?.method ?? 'GET';

      if (method === 'GET') {
        return new Response(null, { status: NO_STREAM });
      }

      const reply = await policed(url, init);

      return cappedReply(
        reply,
        MAX_ANSWER_BYTES,
        () =>
          new UpstreamRefusedError(
            `reading what ${new URL(url.toString()).host} answered`,
            `it is larger than the ${MAX_ANSWER_BYTES / 1024 / 1024} MB Spotlight reads from a tool`,
          ),
      );
    };
  }

  tools(server: string, wearing: McpWearing): Promise<readonly Tool[]> {
    const worn: Worn = { ...wearing, server, seen: WornSecrets.none() };

    return this.#worn.run(worn, () =>
      this.unechoed(worn, () => this.listing(server)),
    );
  }

  call(
    key: string,
    server: string,
    tool: string,
    args: Readonly<Record<string, unknown>>,
    wearing: McpWearing,
  ): Promise<CallToolResult> {
    const pool = `${server} ${key}`;

    const worn: Worn = { ...wearing, server, seen: WornSecrets.none() };

    return this.#worn.run(worn, async () =>
      this.unechoed(worn, () => this.calling(pool, server, tool, args)),
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
      throw refusedAuthorization(error)
        ? new McpAuthorizationRefused(server)
        : error;
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
        throw this.refused(server, error);
      }

      try {
        return await this.callOn(
          pool,
          await this.connected(server),
          tool,
          args,
        );
      } catch (again) {
        throw this.refused(server, again);
      }
    }
  }

  private async unechoed<T>(
    worn: Worn,
    answering: () => Promise<T>,
  ): Promise<T> {
    try {
      const answer = await answering();

      return worn.seen.redactedIn(answer) as T;
    } catch (error) {
      if (!worn.seen.isEmpty) {
        unechoedIn(error, worn.seen);
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

    let kept = false;

    try {
      const result = (await session.client.callTool(
        { name: tool, arguments: { ...args } },
        undefined,
        { timeout: ANSWERS_WITHIN_MS },
      )) as CallToolResult;

      kept = true;

      if (result.isError && session.asked) {
        throw new McpQuestionRefused();
      }

      return result;
    } catch (error) {
      kept = error instanceof McpError;

      throw session.asked ? new McpQuestionRefused() : error;
    } finally {
      this.#busy.delete(session);

      if (kept) {
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
    session.idle = setTimeout(() => this.forget(pool, session), this.idleMs);
    session.idle.unref();
  }

  private forget(pool: string, session: Session): void {
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
      if (request.method === ASKS) {
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

  private refused(server: string, error: unknown): unknown {
    return refusedAuthorization(error)
      ? new McpAuthorizationRefused(server)
      : error;
  }

  private async wear(url: string, request: WornRequest): Promise<WornSecrets> {
    const worn = this.#worn.getStore();

    if (!worn || !sameHost(url, worn.server)) {
      return WornSecrets.none();
    }

    if (worn.connection) {
      request.headers.authorization = `Bearer ${worn.connection}`;
    }

    if (worn.secrets.length === 0) {
      return WornSecrets.none();
    }

    const secrets = await worn.credentials.wornToward(url, worn.secrets);
    secrets.applyTo(request);
    worn.seen = secrets;

    return secrets;
  }
}
