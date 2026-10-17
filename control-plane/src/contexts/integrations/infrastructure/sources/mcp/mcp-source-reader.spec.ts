import type { Reach } from '@integrations/application/ports/integration-runtime.port';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import { McpUnauthorizedError } from '@integrations/infrastructure/mcp/mcp-failures';
import type { McpSessions } from '@integrations/infrastructure/mcp/mcp-sessions';
import { McpSourceReader } from '@integrations/infrastructure/sources/mcp/mcp-source-reader';
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it, vi } from 'vitest';

const SOURCE = DescribedSource.of({
  kind: 'mcp',
  url: 'https://mcp.tracker.example/mcp',
  connected: true,
  fingerprint: 'f'.repeat(64),
});

const REACH: Reach = {
  connection: {
    token: AccessToken.of('the-token'),
    holder: ConnectionHolder.team(),
    handle: null,
    unauthorized: async () => null,
  },
  credentials: { injectedFor: vi.fn() },
};

const tool = (name: string): Tool => ({
  name,
  description: `Does ${name}.`,
  inputSchema: { type: 'object', properties: {} },
});

const listing = (tools: () => Promise<readonly Tool[]>) =>
  new McpSourceReader({ tools: vi.fn(tools) } as unknown as McpSessions);

describe('McpSourceReader', () => {
  it('lists the server’s tools with the team’s connection', async () => {
    const tools = vi.fn(async () => [tool('one')]);
    const read = await new McpSourceReader({
      tools,
    } as unknown as McpSessions).read(SOURCE, REACH);

    expect(read).toMatchObject({
      kind: 'read',
      operations: [{ name: 'one' }],
      passedOver: [],
    });
    expect(tools).toHaveBeenCalledWith(SOURCE.url, {
      connection: 'the-token',
      secrets: [],
      credentials: REACH.credentials,
    });
  });

  it('hashes the same tools the same, in whatever order they are listed', async () => {
    const one = await listing(async () => [tool('a'), tool('b')]).read(
      SOURCE,
      REACH,
    );
    const other = await listing(async () => [tool('b'), tool('a')]).read(
      SOURCE,
      REACH,
    );
    const changed = await listing(async () => [tool('a')]).read(SOURCE, REACH);

    expect(one.kind === 'read' && other.kind === 'read').toBe(true);
    expect(one.kind === 'read' && one.hash.value).toBe(
      other.kind === 'read' && other.hash.value,
    );
    expect(changed.kind === 'read' && changed.hash.value).not.toBe(
      one.kind === 'read' && one.hash.value,
    );
  });

  it('says why the server could not be listed', async () => {
    await expect(
      listing(async () => {
        throw new StreamableHTTPError(403, 'Forbidden');
      }).read(SOURCE, REACH),
    ).resolves.toEqual({
      kind: 'unread',
      problem: 'could not be read: mcp.tracker.example answered 403',
    });
  });

  it('renews the team’s connection once when the server does not accept it, and lists with the new token', async () => {
    const unauthorized = vi.fn(async () => AccessToken.of('fresh'));
    const tools = vi
      .fn()
      .mockRejectedValueOnce(new McpUnauthorizedError(SOURCE.url ?? ''))
      .mockResolvedValueOnce([tool('one')]);
    const read = await new McpSourceReader({
      tools,
    } as unknown as McpSessions).read(SOURCE, {
      ...REACH,
      connection: {
        token: AccessToken.of('stale'),
        holder: ConnectionHolder.team(),
        handle: null,
        unauthorized,
      },
    });

    expect(read.kind).toBe('read');
    expect(unauthorized).toHaveBeenCalledOnce();
    expect(tools.mock.calls.map((call) => call[1].connection)).toEqual([
      'stale',
      'fresh',
    ]);
  });

  it('sends no connection to a server it does not authenticate with by oauth2', async () => {
    const tools = vi.fn(async () => [tool('one')]);

    await new McpSourceReader({ tools } as unknown as McpSessions).read(
      DescribedSource.of({
        kind: 'mcp',
        url: 'https://mcp.tracker.example/mcp',
        fingerprint: 'f'.repeat(64),
      }),
      REACH,
    );

    expect(tools).toHaveBeenCalledWith(
      'https://mcp.tracker.example/mcp',
      expect.objectContaining({ connection: null }),
    );
  });
});
