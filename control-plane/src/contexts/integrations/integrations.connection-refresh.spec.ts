import type {
  Applied,
  AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
import { RefreshConnections } from '@integrations/application/services/refresh-connections.service';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import type { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const runtimeWith = (
  outbound: unknown,
  exchange: unknown = {},
  clients: OAuth2Clients = OAuth2Clients.from('{}'),
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(),
    outbound as HttpOutbound,
    clients,
    exchange as OAuth2Exchange,
  );

const NOW = new Date('2026-09-07T10:00:00.000Z');
const TEAM = TeamId.of('team_1');
const SLACK = SourceKey.of('slack');

const CONFIG = `
version: 1
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

const config = () =>
  ({
    teamId: TEAM,
    repository: Repository.of('acme/api'),
    files: [ConfigurationFile.of('.spotlight/integrations/slack.yml', CONFIG)],
  }) as Applied;

const nearing = (over: { refreshToken?: string | null } = {}) =>
  HostConnection.rehydrate({
    teamId: TEAM,
    source: SLACK,
    accessToken: AccessToken.of('xoxb-old'),
    refreshToken: AccessToken.maybe(
      'refreshToken' in over ? over.refreshToken : 'xoxe-old',
    ),
    expiresAt: new Date('2026-09-07T10:02:00.000Z'),
    scopes: ['chat:write'],
    handle: 'Acme',
    renewalRefusedAt: null,
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
  const save = vi.fn(async (_connection: HostConnection) => undefined);
  const refresh = vi.fn(async () => grant);

  const it = new RefreshConnections(
    {
      expiringBefore: async () => due,
      save,
      of: vi.fn(),
    } as unknown as HostConnectionRepository,
    { of: async () => config() } as unknown as AppliedConfigurationPort,
    runtimeWith(
      {},
      { refresh } as unknown as OAuth2Exchange,
      OAuth2Clients.from('{"slack":{"id":"c-1","secret":"s-1"}}'),
    ),
    { now: () => NOW } as ClockPort,
    { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

  return { it, save, refresh };
};

describe('RefreshConnections', () => {
  it('renews a connection nearing expiry and keeps the fresh token', async () => {
    const { it, save, refresh } = refreshing([nearing()]);

    await it.refresh();

    expect(refresh).toHaveBeenCalledOnce();
    const saved = save.mock.calls[0]?.[0];
    expect(saved?.accessToken.value).toBe('xoxb-new');
  });

  it('leaves one with no refresh token alone', async () => {
    const { it, save, refresh } = refreshing([nearing({ refreshToken: null })]);

    await it.refresh();

    expect(refresh).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps the old token, and remembers the refusal, when the host refuses to renew', async () => {
    const { it, save } = refreshing([nearing()], null);

    await it.refresh();

    const saved = save.mock.calls[0]?.[0];
    expect(saved?.accessToken.value).toBe('xoxb-old');
    expect(saved?.renewalRefusedAt).toEqual(NOW);
    expect(saved?.pullEvents().map((each) => each.kind)).toEqual([
      'integrations.host-renewal-refused',
    ]);
  });

  it('does nothing when nothing is near expiry', async () => {
    const { it, refresh } = refreshing([]);

    await it.refresh();

    expect(refresh).not.toHaveBeenCalled();
  });
});
