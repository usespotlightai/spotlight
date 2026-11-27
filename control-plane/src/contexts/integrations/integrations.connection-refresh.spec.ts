import {
  scopedTo,
  unscoped,
} from '@identity/application/ports/workspace-outbound-scope.fake-spec';
import type { WorkspaceOutboundScopePort } from '@identity/application/ports/workspace-outbound-scope.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import { noFiles } from '@integrations/application/ports/notice-file-reader.fake-spec';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import { ConnectionRefresh } from '@integrations/application/services/connection-refresh.service';
import { RefreshConnections } from '@integrations/application/services/refresh-connections.service';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuthScope } from '@integrations/domain/value-objects/oauth-scope.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import { OAuth2ClientId } from '@integrations/domain/value-objects/oauth2-client-id.vo';
import { RefreshToken } from '@integrations/domain/value-objects/refresh-token.vo';
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
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const expressions = new CelExpressionEngine();

const runtimeWith = (
  outbound: Partial<HttpOutbound>,
  exchange: Partial<OAuth2Exchange> = {},
  clients: OAuth2ClientsPort = clientsFrom(),
  hosts: WorkspaceOutboundScopePort = unscoped,
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(expressions, operationsContaining()),
    partial<HttpOutbound>(outbound),
    clients,
    partial<OAuth2Exchange>(exchange),
    discoveringNothing(),
    callingNoServer(),
    unlimited,
    hosts,
    noNetwork,
    noFiles,
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

const nearing = (
  over: { refreshToken?: string | null; client?: string } = {},
) =>
  IntegrationConnection.rehydrate({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    integration: SLACK,
    owner: ConnectionOwner.team(),
    client: OAuth2ClientId.of(over.client ?? 'c-1'),
    accessToken: AccessToken.of('xoxb-old'),
    refreshToken: RefreshToken.maybe(
      'refreshToken' in over ? over.refreshToken : 'xoxe-old',
    ),
    expiresAt: new Date('2026-09-07T10:02:00.000Z'),
    scopes: [OAuthScope.of('chat:write')],
    linkedAccount: 'Acme',
    refreshFailedAt: null,
    refreshClaim: null,
    version: 1,
    connectedAt: new Date('2026-09-01T00:00:00.000Z'),
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
  const refresh = vi.fn(() => {
    allowedWhileRefreshing.push(
      OutboundScope.allows('slack.com'),
      OutboundScope.allows('elsewhere.example'),
    );
    return Promise.resolve(tokens);
  });
  const clock = partial<ClockPort>({ now: () => NOW });
  const warn = vi.fn();
  const info = vi.fn();

  const it = new RefreshConnections(
    connections,
    new ConnectionRefresh(
      connections,
      partial<DefinedIntegrationsPort>({
        ofTeam: () => Promise.resolve(config()),
      }),
      runtimeWith(
        {},
        { refresh },
        clientsFrom('{"slack":{"id":"c-1","secret":"s-1"}}'),
        hosts,
      ),
      clock,
      { for: async () => {} },
    ),
    clock,
    { warn, info, error: vi.fn(), debug: vi.fn() },
  );

  return { it, connections, refresh, warn, info, allowedWhileRefreshing };
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
    expect(warn).toHaveBeenCalledWith(
      { team: 'team_1', integration: 'slack', owner: 'team' },
      'The integration did not refresh a connection',
    );
  });

  it('does not refresh a connection made through another OAuth client, and asks to connect again', async () => {
    const { it, connections, refresh, info } = refreshing([
      nearing({ client: 'c-old' }),
    ]);

    await it.refresh();

    const stored = await storedNow(connections);
    expect(refresh).not.toHaveBeenCalled();
    expect(stored?.accessToken.value).toBe('xoxb-old');
    expect(stored?.refreshFailedAt).toEqual(NOW);
    expect(stored?.usable).toBe(false);
    expect(info).toHaveBeenCalledWith(
      { team: 'team_1', integration: 'slack', owner: 'team' },
      'Did not refresh a connection made through another OAuth client',
    );
  });

  it('leaves a connection that someone else refreshes to them', async () => {
    const claimed = nearing().claimRefresh(NOW);
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
