import type {
  CallAuth,
  IntegrationTaskView,
  ResolvedTool,
} from '@integrations/application/ports/integration-runtime.port';
import { SpecDocument } from '@integrations/domain/aggregates/spec-document.aggregate';
import { EgressBlockedError } from '@integrations/domain/exceptions/egress-blocked.error';
import { ToolAskedMidCallError } from '@integrations/domain/exceptions/tool-asked-mid-call.error';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import {
  McpQuestionUnsupportedError,
  McpUnauthorizedError,
} from '@integrations/infrastructure/mcp/mcp-failures';
import type { McpSessions } from '@integrations/infrastructure/mcp/mcp-sessions';
import type { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { unlimited } from '@integrations/infrastructure/outbound/outbound-limits.fake-spec';
import { clientsFrom } from '@integrations/integrations.clients.fake-spec';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
import { discoveringNothing } from '@integrations/integrations.mcp.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it, vi } from 'vitest';

const expressions = new CelExpressionEngine();

const HASH = ContentHash.of('c'.repeat(64));

const SERVER = 'https://mcp.tracker.example/mcp';

const TRACKER = `integration: tracker
name: Tracker
connection:
  actsAs: requester
  oauth2:
    discover: true
mcp:
  url: ${SERVER}
  auth:
    oauth2:
      connection: true
`;

const DELETE = SpecOperation.of({
  name: 'delete-issue',
  upstream: 'delete_issue',
  description: 'Delete an issue for good.',
  inputs: [],
  writes: true,
  call: { kind: 'mcp', tool: 'delete_issue' },
});

const TASK: IntegrationTaskView = {
  taskId: 'task_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  line: 'delivery',
  station: 'Implementation',
  stationKey: 'implementation',
  marks: {},
  waiting: null,
};

const resolving = async (call: McpSessions['call']): Promise<ResolvedTool> => {
  const runtime = new CompiledIntegrationRuntime(
    new IntegrationReader(
      expressions,
      operationsContaining(
        SpecDocument.read({
          hash: HASH,
          kind: 'mcp',
          operations: [DELETE],
          skipped: [],
          readAt: new Date('2026-10-05T12:00:00.000Z'),
        }),
      ),
    ),
    {} as HttpOutbound,
    clientsFrom(),
    {} as OAuth2Exchange,
    discoveringNothing(),
    { call: vi.fn(call) } as unknown as McpSessions,
    unlimited,
  );
  const resolved = await runtime.tool(
    [
      defined(TRACKER, {
        hash: HASH.value,
        tools: ['tracker.delete-issue'],
      }),
    ],
    'tracker.delete-issue',
    TASK,
  );

  if (!resolved) {
    throw new Error('the MCP tool was not resolved');
  }

  return resolved;
};

const callAuthAs = (
  token: string,
  refreshed: string | null = null,
): CallAuth & { unauthorized: ReturnType<typeof vi.fn> } => {
  const unauthorized = vi.fn(async () =>
    refreshed ? AccessToken.of(refreshed) : null,
  );

  return {
    unauthorized,
    workspace: async () => 'ws_1',
    connection: {
      token: AccessToken.of(token),
      owner: ConnectionOwner.person(UserId.of('ada')),
      linkedAccount: '@ada',
      unauthorized,
    },
    credentials: { injectedFor: vi.fn() },
  };
};

describe('a tool an MCP server offers', () => {
  it('calls the server’s own tool with the inputs, in a session of the person’s own', async () => {
    const call = vi.fn(async () => ({
      content: [{ type: 'text' as const, text: '{"deleted":"ENG-1"}' }],
    }));
    const resolved = await resolving(call);

    await expect(
      resolved.call({ id: 'ENG-1' }, callAuthAs('ada-token')),
    ).resolves.toEqual({ deleted: 'ENG-1' });
    expect(call).toHaveBeenCalledWith(
      expect.stringMatching(/^team_1:tracker:oauth2:person:ada:[0-9a-f]{16}$/),
      SERVER,
      'delete_issue',
      { id: 'ENG-1' },
      expect.objectContaining({ connection: 'ada-token', secrets: [] }),
    );
    expect(resolved.declared).toMatchObject({
      tool: 'tracker.delete-issue',
      integrationName: 'Tracker',
      approval: { because: 'It changes data in Tracker.' },
    });
  });

  it('refreshes an unauthorized connection once and calls again, in a new session', async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(new McpUnauthorizedError(SERVER))
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'done' }] });
    const callAuth = callAuthAs('stale', 'fresh');
    const resolved = await resolving(call);

    await expect(resolved.call({}, callAuth)).resolves.toBe('done');
    expect(callAuth.unauthorized).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[1]?.[4]).toMatchObject({ connection: 'fresh' });
    expect(call.mock.calls[0]?.[0]).not.toBe(call.mock.calls[1]?.[0]);
  });

  it('fails when the connection cannot be refreshed', async () => {
    const resolved = await resolving(async () => {
      throw new McpUnauthorizedError(SERVER);
    });

    await expect(resolved.call({}, callAuthAs('stale'))).rejects.toThrow(
      'using tracker.delete-issue: mcp.tracker.example answered 401',
    );
  });

  it('fails a call the server asked a question in the middle of, typed as such', async () => {
    const resolved = await resolving(async () => {
      throw new McpQuestionUnsupportedError();
    });

    await expect(
      resolved.call({}, callAuthAs('ada-token')),
    ).rejects.toBeInstanceOf(ToolAskedMidCallError);
  });

  it('lets a blocked call to the host through as it is', async () => {
    const blocked = new EgressBlockedError(
      'mcp.tracker.example',
      'Host is not on the allowed list.',
    );
    const resolved = await resolving(async () => {
      throw blocked;
    });

    await expect(resolved.call({}, callAuthAs('ada-token'))).rejects.toBe(
      blocked,
    );
  });
});
