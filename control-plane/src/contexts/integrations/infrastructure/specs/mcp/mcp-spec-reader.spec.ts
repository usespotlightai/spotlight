import type { CallAuth } from '@integrations/application/ports/integration-runtime.port';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { McpUnauthorizedError } from '@integrations/infrastructure/mcp/mcp-failures';
import type { McpSessions } from '@integrations/infrastructure/mcp/mcp-sessions';
import { McpSpecReader } from '@integrations/infrastructure/specs/mcp/mcp-spec-reader';
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it, vi } from 'vitest';

const SPEC = ApiSpec.of({
  kind: 'mcp',
  url: 'https://mcp.tracker.example/mcp',
  connected: true,
  fingerprint: 'f'.repeat(64),
});

const CALL_AUTH: CallAuth = {
  workspace: async () => 'ws_1',
  connection: {
    token: AccessToken.of('the-token'),
    owner: ConnectionOwner.team(),
    linkedAccount: null,
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
  new McpSpecReader({ tools: vi.fn(tools) } as unknown as McpSessions);

describe('McpSpecReader', () => {
  it('lists the server’s tools with the team’s connection', async () => {
    const tools = vi.fn(async () => [tool('one')]);
    const read = await new McpSpecReader({
      tools,
    } as unknown as McpSessions).read(SPEC, CALL_AUTH);

    expect(read).toMatchObject({
      kind: 'read',
      operations: [{ name: 'one' }],
      skipped: [],
    });
    expect(tools).toHaveBeenCalledWith(SPEC.url, {
      connection: 'the-token',
      secrets: [],
      credentials: CALL_AUTH.credentials,
    });
  });

  it('hashes the same tools the same, in whatever order they are listed', async () => {
    const one = await listing(async () => [tool('a'), tool('b')]).read(
      SPEC,
      CALL_AUTH,
    );
    const other = await listing(async () => [tool('b'), tool('a')]).read(
      SPEC,
      CALL_AUTH,
    );
    const changed = await listing(async () => [tool('a')]).read(
      SPEC,
      CALL_AUTH,
    );

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
      }).read(SPEC, CALL_AUTH),
    ).resolves.toEqual({
      kind: 'unread',
      problem: 'could not be read: mcp.tracker.example answered 403',
    });
  });

  it('refreshes the team’s connection once when the server does not accept it, and lists with the new token', async () => {
    const unauthorized = vi.fn(async () => AccessToken.of('fresh'));
    const tools = vi
      .fn()
      .mockRejectedValueOnce(new McpUnauthorizedError(SPEC.url ?? ''))
      .mockResolvedValueOnce([tool('one')]);
    const read = await new McpSpecReader({
      tools,
    } as unknown as McpSessions).read(SPEC, {
      ...CALL_AUTH,
      connection: {
        token: AccessToken.of('stale'),
        owner: ConnectionOwner.team(),
        linkedAccount: null,
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

    await new McpSpecReader({ tools } as unknown as McpSessions).read(
      ApiSpec.of({
        kind: 'mcp',
        url: 'https://mcp.tracker.example/mcp',
        fingerprint: 'f'.repeat(64),
      }),
      CALL_AUTH,
    );

    expect(tools).toHaveBeenCalledWith(
      'https://mcp.tracker.example/mcp',
      expect.objectContaining({ connection: null }),
    );
  });
});
