import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import { ConnectionRefresh } from '@integrations/application/services/connection-refresh.service';
import { RefreshConnections } from '@integrations/application/services/refresh-connections.service';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import type { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { noNetwork } from '@integrations/infrastructure/outbound/network-outbound.fake-spec';
import { unlimited } from '@integrations/infrastructure/outbound/outbound-limits.fake-spec';
import { clientsFrom } from '@integrations/integrations.clients.fake-spec';
import { InMemoryIntegrationConnections } from '@integrations/integrations.connections.fake-spec';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
import {
  callingNoServer,
  discoveringNothing,
} from '@integrations/integrations.mcp.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { OutboundScope } from '@platform/outbound/outbound-scope';
import {
  scopedTo,
  unscoped,
} from '@platform/outbound/outbound-scope.fake-spec';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { WorkspaceOutboundScopePort } from '@shared-kernel/application/ports/workspace-outbound-scope.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const expressions = new CelExpressionEngine();

const runtimeWith = (
  outbound: unknown,
  exchange: unknown = {},
  clients: OAuth2ClientsPort = clientsFrom(),
  hosts: WorkspaceOutboundScopePort = unscoped,
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(expressions, operationsContaining()),
    outbound as HttpOutbound,
    clients,
    exchange as OAuth2Exchange,
    discoveringNothing(),
    callingNoServer(),
    unlimited,
    hosts,
    noNetwork,
  );

const NOW = new Date('2026-09-07T10:00:00.000Z');
const TEAM = TeamId.of('team_1');
const SLACK = IntegrationKey.of('slack');

const CONFIG = `
integration: slack
connection:
  oauth2:
    authorize: https://slack.com/oauth/authorize
    token: https://slack.com/api/oauth.v2.access
webhook:
  verify:
    token:
      secret: secret.SLACK_SIGNING_SECRET
  events:
    - when: '\${{ true }}'
      raise:
        happening: slack.app_mention
        marks:
          - kind: slack.thread
            value: '\${{ body.event.ts }}'
`;

const config = () => [defined(CONFIG)];

const nearing = (over: { refreshToken?: string | null } = {}) =>
  IntegrationConnection.rehydrate({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    integration: SLACK,
    owner: ConnectionOwner.team(),
    accessToken: AccessToken.of('xoxb-old'),
    refreshToken: AccessToken.maybe(
      'refreshToken' in over ? over.refreshToken : 'xoxe-old',
    ),
    expiresAt: new Date('2026-09-07T10:02:00.000Z'),
    scopes: ['chat:write'],
    linkedAccount: 'Acme',
    refreshFailedAt: null,
    refreshClaim: null,
    version: 1,
  });

const refreshing = (
  due: readonly IntegrationConnection[],
  tokens: OAuthTokens | null = OAuthTokens.of({
    accessToken: 'xoxb-new',
    refreshToken: 'xoxe-new',
    expiresAt: new Date('2026-09-07T11:00:00.000Z'),
    scopes: ['chat:write'],
    linkedAccount: 'Acme',
  }),
  hosts: WorkspaceOutboundScopePort = unscoped,
) => {
  const connections = new InMemoryIntegrationConnections();
  for (const each of due) {
    connections.add(each);
  }
  const allowedWhileRefreshing: boolean[] = [];
  const refresh = vi.fn(async () => {
    allowedWhileRefreshing.push(
      OutboundScope.allows('slack.com'),
      OutboundScope.allows('elsewhere.example'),
    );
    return tokens;
  });
  const clock = { now: () => NOW } as ClockPort;
  const warn = vi.fn();

  const it = new RefreshConnections(
    connections,
    new ConnectionRefresh(
      connections,
      { ofTeam: async () => config() } as unknown as DefinedIntegrationsPort,
      runtimeWith(
        {},
        { refresh } as unknown as OAuth2Exchange,
        clientsFrom('{"slack":{"id":"c-1","secret":"s-1"}}'),
        hosts,
      ),
      clock,
    ),
    clock,
    { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

  return { it, connections, refresh, warn, allowedWhileRefreshing };
};

const storedNow = (connections: InMemoryIntegrationConnections) =>
  connections.of(TEAM, SLACK, ConnectionOwner.team());

describe('RefreshConnections', () => {
  it('refreshes within the outbound scope of the connection’s workspace', async () => {
    const { it, allowedWhileRefreshing } = refreshing(
      [nearing()],
      undefined,
      scopedTo('slack.com'),
    );

    await it.refresh();

    expect(allowedWhileRefreshing).toEqual([true, false]);
  });

  it('refreshes a connection near expiry and stores the fresh tokens', async () => {
    const { it, connections, refresh } = refreshing([nearing()]);

    await it.refresh();

    const stored = await storedNow(connections);
    expect(refresh).toHaveBeenCalledOnce();
    expect(stored?.accessToken.value).toBe('xoxb-new');
    expect(stored?.refreshToken?.value).toBe('xoxe-new');
    expect(stored?.refreshClaim).toBeNull();
  });

  it('leaves one with no refresh token alone', async () => {
    const { it, connections, refresh } = refreshing([
      nearing({ refreshToken: null }),
    ]);

    await it.refresh();

    expect(refresh).not.toHaveBeenCalled();
    expect(connections.saved).toEqual([]);
  });

  it('keeps the old token, and remembers the failure, when the token refresh fails', async () => {
    const { it, connections, warn } = refreshing([nearing()], null);

    await it.refresh();

    const stored = await storedNow(connections);
    expect(stored?.accessToken.value).toBe('xoxb-old');
    expect(stored?.refreshFailedAt).toEqual(NOW);
    expect(stored?.refreshClaim).toBeNull();
    expect(connections.events.map((each) => each.kind)).toEqual([
      'integrations.connection-refresh-failed',
    ]);
    expect(warn).toHaveBeenCalledWith(
      { team: 'team_1', integration: 'slack', owner: 'team' },
      'The integration did not refresh a connection',
    );
  });

  it('leaves a connection that someone else refreshes to them', async () => {
    const claimed = nearing().claimRefresh(NOW, 30_000);
    const { it, refresh } = refreshing([claimed]);

    await it.refresh();

    expect(refresh).not.toHaveBeenCalled();
  });

  it('does nothing when nothing is near expiry', async () => {
    const { it, refresh } = refreshing([]);

    await it.refresh();

    expect(refresh).not.toHaveBeenCalled();
  });
});
