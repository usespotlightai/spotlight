import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import { EgressBlockedError } from '@integrations/domain/exceptions/egress-blocked.error';
import {
  McpQuestionUnsupportedError,
  McpUnauthorizedError,
} from '@integrations/infrastructure/mcp/mcp-failures';
import {
  type FakeMcpServer,
  fakeMcpServer,
} from '@integrations/infrastructure/mcp/mcp-server.fake-spec';
import { McpSessions } from '@integrations/infrastructure/mcp/mcp-sessions';
import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const injectingKey = {
  connection: null,
  secrets: ['TRACKER_KEY'],
  credentials: {
    injectedFor: async () =>
      InjectedSecrets.of([
        { location: 'query', name: 'key', value: 'k/live', bare: 'k/live' },
      ]),
  } as Credentials,
};

const serving = async (
  answer: Parameters<typeof createServer>[1],
): Promise<{ readonly origin: string; readonly server: Server }> => {
  const server = createServer(answer);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    server,
  };
};

const injectingNothing = {
  connection: null,
  secrets: [],
  credentials: {
    injectedFor: async () => InjectedSecrets.none(),
  } as Credentials,
};

describe('McpSessions', () => {
  let server: FakeMcpServer;
  let sessions: McpSessions;

  beforeEach(async () => {
    server = await fakeMcpServer();
    sessions = new McpSessions(new OutboundPolicy([new URL(server.url).host]));
  });

  afterEach(async () => {
    sessions.onModuleDestroy();
    await server.close();
  });

  it('lists the tools a server offers, with their schemas and hints', async () => {
    const tools = await sessions.tools(server.url, injectingNothing);

    expect(tools.map((each) => each.name)).toEqual([
      'search_issues',
      'delete_issue',
      'check_policy',
      'ask_first',
    ]);
    expect(tools[0]?.annotations).toEqual({ readOnlyHint: true });
    expect(tools[0]?.inputSchema.required).toEqual(['query']);
  });

  it('keeps one session per connection key, and opens another for another key', async () => {
    const search = (key: string) =>
      sessions.call(
        key,
        server.url,
        'search_issues',
        { query: 'queue' },
        injectingNothing,
      );

    await search('team_1:tracker:team:none');
    await search('team_1:tracker:team:none');
    expect(server.started()).toBe(1);

    await search('team_1:tracker:person:ada:none');
    expect(server.started()).toBe(2);
    expect(server.called).toHaveLength(3);
  });

  it('gives each call in flight a session of its own, so a question is put down to the call it came in', async () => {
    const key = 'team_1:tracker:team:none';
    const [asking, searching] = await Promise.allSettled([
      sessions.call(key, server.url, 'ask_first', {}, injectingNothing),
      sessions.call(
        key,
        server.url,
        'search_issues',
        { query: 'queue' },
        injectingNothing,
      ),
    ]);

    expect(asking.status).toBe('rejected');
    expect(searching).toMatchObject({
      status: 'fulfilled',
      value: { structuredContent: { issues: [{ id: 'ENG-1' }] } },
    });
    expect(server.started()).toBe(2);
  });

  it('opens no stream for the server to push on, and calls only with POST', async () => {
    await sessions.call(
      'team_1:tracker:team:none',
      server.url,
      'search_issues',
      { query: 'queue' },
      injectingNothing,
    );

    expect(server.heard.map((each) => each.method)).not.toContain('GET');
  });

  it('ends the session at the server when it lists, and when a session idles out', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    try {
      const idling = new McpSessions(
        new OutboundPolicy([new URL(server.url).host]),
        globalThis.fetch,
        1_000,
      );

      await idling.tools(server.url, injectingNothing);
      await idling.call(
        'team_1:tracker:team:none',
        server.url,
        'search_issues',
        { query: 'queue' },
        injectingNothing,
      );
      vi.advanceTimersByTime(1_001);
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(
        server.heard.filter((each) => each.method === 'DELETE'),
      ).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps sessions of one key apart from another server’s', async () => {
    const other = await fakeMcpServer();
    const both = new McpSessions(
      new OutboundPolicy([new URL(server.url).host, new URL(other.url).host]),
    );

    try {
      const search = (url: string) =>
        both.call(
          'team_1:tracker:team:none',
          url,
          'search_issues',
          { query: 'queue' },
          injectingNothing,
        );

      await search(server.url);
      await search(other.url);

      expect(server.started()).toBe(1);
      expect(other.started()).toBe(1);
    } finally {
      both.onModuleDestroy();
      await other.close();
    }
  });

  it('starts again once when the server has forgotten the session', async () => {
    const search = () =>
      sessions.call(
        'team_1:tracker:team:none',
        server.url,
        'search_issues',
        { query: 'queue' },
        injectingNothing,
      );

    await search();
    server.forgetSessions();

    await expect(search()).resolves.toMatchObject({
      structuredContent: { issues: [{ id: 'ENG-1' }] },
    });
    expect(server.started()).toBe(2);
  });

  it('closes a session left idle', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    try {
      const idling = new McpSessions(
        new OutboundPolicy([new URL(server.url).host]),
        globalThis.fetch,
        1_000,
      );
      const search = () =>
        idling.call(
          'team_1:tracker:team:none',
          server.url,
          'search_issues',
          { query: 'queue' },
          injectingNothing,
        );

      await search();
      vi.advanceTimersByTime(1_001);
      await search();

      expect(server.started()).toBe(2);
      idling.onModuleDestroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails a call the server asks a question in the middle of, saying why', async () => {
    await expect(
      sessions.call(
        'team_1:tracker:team:none',
        server.url,
        'ask_first',
        {},
        injectingNothing,
      ),
    ).rejects.toBeInstanceOf(McpQuestionUnsupportedError);
  });

  it('injects the connection and the secrets only for the server', async () => {
    const injectedFor = vi.fn(async () =>
      InjectedSecrets.of([
        {
          location: 'header',
          name: 'x-api-key',
          value: 'tk_live',
          bare: 'tk_live',
        },
      ]),
    );

    await sessions.call(
      'team_1:tracker:team:abc',
      server.url,
      'search_issues',
      { query: 'queue' },
      {
        connection: 'the-token',
        secrets: ['TRACKER_KEY'],
        credentials: { injectedFor },
      },
    );

    expect(server.heard.every((each) => each.authorization)).toBe(true);
    expect(server.heard[0]).toMatchObject({
      authorization: 'Bearer the-token',
      apiKey: 'tk_live',
    });
    expect(injectedFor).toHaveBeenCalledWith(server.url, ['TRACKER_KEY']);
  });

  it('injects a secret in the query, and takes it out of what the server answers', async () => {
    const answered = await sessions.call(
      'team_1:tracker:team:key',
      server.url,
      'delete_issue',
      { id: 'tk/live' },
      {
        connection: null,
        secrets: ['TRACKER_KEY'],
        credentials: {
          injectedFor: async () =>
            InjectedSecrets.of([
              {
                location: 'query',
                name: 'key',
                value: 'tk/live',
                bare: 'tk/live',
              },
            ]),
        },
      },
    );

    expect(server.heard[server.heard.length - 1]?.key).toBe('tk/live');
    expect(JSON.stringify(answered)).not.toContain('tk/live');
    expect(JSON.stringify(answered)).toContain('[secret]');
  });

  it('says when the server does not accept the connection it was handed', async () => {
    const guarded = await fakeMcpServer({ token: 'right' });
    const asking = new McpSessions(
      new OutboundPolicy([new URL(guarded.url).host]),
    );

    try {
      await expect(
        asking.call(
          'team_1:tracker:team:wrong',
          guarded.url,
          'search_issues',
          { query: 'queue' },
          { ...injectingNothing, connection: 'wrong' },
        ),
      ).rejects.toBeInstanceOf(McpUnauthorizedError);
      await expect(
        asking.tools(guarded.url, { ...injectingNothing, connection: 'wrong' }),
      ).rejects.toBeInstanceOf(McpUnauthorizedError);
    } finally {
      asking.onModuleDestroy();
      await guarded.close();
    }
  });

  it('says why a server did not list its tools, without the key it echoed', async () => {
    const failing = await serving((request, reply) => {
      let body = '';
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        const id = (JSON.parse(body) as { id?: number }).id ?? null;
        reply.writeHead(200, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32600, message: `no such key in ${request.url}` },
          }),
        );
      });
    });
    const listing = new McpSessions(
      new OutboundPolicy([new URL(failing.origin).host]),
    );

    try {
      const failure = await listing
        .tools(`${failing.origin}/mcp`, injectingKey)
        .catch((error: unknown) => error as Error);

      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toContain('[secret]');
      expect((failure as Error).message).not.toMatch(/k(%2F|\/)live/);
    } finally {
      listing.onModuleDestroy();
      failing.server.close();
    }
  });

  it('carries no key to another host a server redirects to', async () => {
    const heard: string[] = [];
    const elsewhere = await serving((request, reply) => {
      heard.push(request.url ?? '');
      reply.writeHead(404).end();
    });
    const moving = await serving((request, reply) => {
      reply
        .writeHead(307, { location: `${elsewhere.origin}${request.url}` })
        .end();
    });
    const listing = new McpSessions(
      new OutboundPolicy([
        new URL(moving.origin).host,
        new URL(elsewhere.origin).host,
      ]),
    );

    try {
      await listing
        .tools(`${moving.origin}/mcp`, injectingKey)
        .catch(() => null);

      expect(heard.length).toBeGreaterThan(0);
      expect(heard.join(' ')).not.toMatch(/k(%2F|\/)live/);
    } finally {
      listing.onModuleDestroy();
      moving.server.close();
      elsewhere.server.close();
    }
  });

  it('calls no server on a host the deployment does not allow', async () => {
    const nowhere = new McpSessions(new OutboundPolicy(['elsewhere.example']));

    await expect(
      nowhere.tools(server.url, injectingNothing),
    ).rejects.toBeInstanceOf(EgressBlockedError);
    expect(server.heard).toEqual([]);
  });
});
