import { randomUUID } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ElicitResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

interface McpReceived {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | undefined;
  readonly apiKey: string | undefined;
  readonly key: string | null;
}

interface McpCalled {
  readonly tool: string;
  readonly args: Readonly<Record<string, unknown>>;
}

type Other = (
  request: IncomingMessage,
  reply: ServerResponse,
  origin: string,
) => Promise<boolean>;

export interface FakeMcpServer {
  readonly origin: string;
  readonly url: string;
  readonly received: McpReceived[];
  readonly called: McpCalled[];
  started(): number;
  evictSessions(): void;
  close(): Promise<void>;
}

const PATH = '/mcp';

const registered = (server: McpServer, called: McpCalled[]): McpServer => {
  server.registerTool(
    'search_issues',
    {
      title: 'Search issues',
      description: 'Search the tracker for issues matching a query.',
      inputSchema: {
        query: z.string().describe('What to look for'),
        limit: z.number().int().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      called.push({ tool: 'search_issues', args });

      return {
        content: [{ type: 'text', text: 'ENG-1 Queue stuck' }],
        structuredContent: {
          issues: [{ id: 'ENG-1', title: 'Queue stuck' }],
        },
      };
    },
  );
  server.registerTool(
    'delete_issue',
    {
      description: 'Delete an issue for good.',
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true },
    },
    async (args) => {
      called.push({ tool: 'delete_issue', args });

      return { content: [{ type: 'text', text: `{"deleted":"${args.id}"}` }] };
    },
  );
  server.registerTool(
    'check_policy',
    {
      description: 'Say whether a tool may be used right now.',
      inputSchema: { tool: z.string() },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      called.push({ tool: 'check_policy', args });

      return {
        isError: true,
        content: [{ type: 'text', text: 'Deleting is frozen this week.' }],
      };
    },
  );
  server.registerTool(
    'ask_first',
    {
      description: 'Ask the person before doing anything.',
      annotations: { readOnlyHint: true },
    },
    async (extra) => {
      called.push({ tool: 'ask_first', args: {} });

      await extra.sendRequest(
        {
          method: 'elicitation/create',
          params: {
            message: 'Are you sure?',
            requestedSchema: { type: 'object', properties: {} },
          },
        },
        ElicitResultSchema,
      );

      return { content: [{ type: 'text', text: 'asked' }] };
    },
  );

  return server;
};

const headerOf = (request: IncomingMessage, name: string) => {
  const value = request.headers[name];

  return Array.isArray(value) ? value[0] : value;
};

export const fakeMcpServer = async (
  options: { readonly token?: string; readonly other?: Other } = {},
): Promise<FakeMcpServer> => {
  const sessions = new Map<string, StreamableHTTPServerTransport>();
  const received: McpReceived[] = [];
  const called: McpCalled[] = [];
  let started = 0;
  let origin = '';

  const http = createServer(async (request, reply) => {
    const path = new URL(request.url ?? '/', origin).pathname;
    const authorization = headerOf(request, 'authorization');

    received.push({
      method: request.method ?? 'GET',
      path,
      authorization,
      apiKey: headerOf(request, 'x-api-key'),
      key: new URL(request.url ?? '/', origin).searchParams.get('key'),
    });

    if (path !== PATH) {
      if (!(await options.other?.(request, reply, origin))) {
        reply.writeHead(404).end();
      }

      return;
    }

    if (options.token && authorization !== `Bearer ${options.token}`) {
      reply
        .writeHead(401, {
          'www-authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource${PATH}"`,
        })
        .end();
      return;
    }

    const id = headerOf(request, 'mcp-session-id');
    const existing = id ? sessions.get(id) : undefined;

    if (id && !existing) {
      reply.writeHead(404).end();
      return;
    }

    const transport =
      existing ??
      new StreamableHTTPServerTransport({
        sessionIdGenerator: randomUUID,
        onsessioninitialized: (opened) => {
          sessions.set(opened, transport);
        },
      });

    if (!existing) {
      started += 1;
      await registered(
        new McpServer({ name: 'tracker', version: '1.0.0' }),
        called,
      ).connect(transport);
    }

    await transport.handleRequest(request, reply);
  });

  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;

  return {
    origin,
    url: `${origin}${PATH}`,
    received,
    called,
    started: () => started,
    evictSessions: () => sessions.clear(),
    close: async () => {
      for (const transport of sessions.values()) {
        await transport.close();
      }
      http.closeAllConnections();
      await new Promise((resolve) => http.close(resolve));
    },
  };
};
