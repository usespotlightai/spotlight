import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import { ConnectionRenewal } from '@integrations/application/services/connection-renewal.service';
import { RefreshConnections } from '@integrations/application/services/refresh-connections.service';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import type { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { clientsFrom } from '@integrations/integrations.clients.fake-spec';
import { InMemoryHostConnections } from '@integrations/integrations.connections.fake-spec';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsHolding } from '@integrations/integrations.documents.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const expressions = new CelExpressionEngine();

const runtimeWith = (
  outbound: unknown,
  exchange: unknown = {},
  clients: OAuth2ClientsPort = clientsFrom(),
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(expressions, operationsHolding()),
    outbound as HttpOutbound,
    clients,
    exchange as OAuth2Exchange,
  );

const NOW = new Date('2026-09-07T10:00:00.000Z');
const TEAM = TeamId.of('team_1');
const SLACK = SourceKey.of('slack');

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
  HostConnection.rehydrate({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    source: SLACK,
    holder: ConnectionHolder.team(),
    accessToken: AccessToken.of('xoxb-old'),
    refreshToken: AccessToken.maybe(
      'refreshToken' in over ? over.refreshToken : 'xoxe-old',
    ),
    expiresAt: new Date('2026-09-07T10:02:00.000Z'),
    scopes: ['chat:write'],
    handle: 'Acme',
    renewalRefusedAt: null,
    renewalClaim: null,
    version: 1,
  });

const refreshing = (
  due: readonly HostConnection[],
  grant: HostGrant | null = HostGrant.of({
    accessToken: 'xoxb-new',
    refreshToken: 'xoxe-new',
    expiresAt: new Date('2026-09-07T11:00:00.000Z'),
    scopes: ['chat:write'],
    handle: 'Acme',
  }),
) => {
  const connections = new InMemoryHostConnections();
  for (const each of due) {
    connections.hold(each);
  }
  const refresh = vi.fn(async () => grant);
  const clock = { now: () => NOW } as ClockPort;
  const warn = vi.fn();

  const it = new RefreshConnections(
    connections,
    new ConnectionRenewal(
      connections,
      { ofTeam: async () => config() } as unknown as DefinedIntegrationsPort,
      runtimeWith(
        {},
        { refresh } as unknown as OAuth2Exchange,
        clientsFrom('{"slack":{"id":"c-1","secret":"s-1"}}'),
      ),
      clock,
    ),
    clock,
    { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

  return { it, connections, refresh, warn };
};

const heldNow = (connections: InMemoryHostConnections) =>
  connections.of(TEAM, SLACK, ConnectionHolder.team());

describe('RefreshConnections', () => {
  it('renews a connection nearing expiry and keeps the fresh tokens', async () => {
    const { it, connections, refresh } = refreshing([nearing()]);

    await it.refresh();

    const held = await heldNow(connections);
    expect(refresh).toHaveBeenCalledOnce();
    expect(held?.accessToken.value).toBe('xoxb-new');
    expect(held?.refreshToken?.value).toBe('xoxe-new');
    expect(held?.renewalClaim).toBeNull();
  });

  it('leaves one with no refresh token alone', async () => {
    const { it, connections, refresh } = refreshing([
      nearing({ refreshToken: null }),
    ]);

    await it.refresh();

    expect(refresh).not.toHaveBeenCalled();
    expect(connections.saved).toEqual([]);
  });

  it('keeps the old token, and remembers the refusal, when the host refuses to renew', async () => {
    const { it, connections, warn } = refreshing([nearing()], null);

    await it.refresh();

    const held = await heldNow(connections);
    expect(held?.accessToken.value).toBe('xoxb-old');
    expect(held?.renewalRefusedAt).toEqual(NOW);
    expect(held?.renewalClaim).toBeNull();
    expect(connections.events.map((each) => each.kind)).toEqual([
      'integrations.host-renewal-refused',
    ]);
    expect(warn).toHaveBeenCalledWith(
      { team: 'team_1', source: 'slack', holder: 'team' },
      'A host refused to renew a connection',
    );
  });

  it('leaves a connection someone else is renewing to them', async () => {
    const claimed = nearing().claimRenewal(NOW, 30_000);
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
