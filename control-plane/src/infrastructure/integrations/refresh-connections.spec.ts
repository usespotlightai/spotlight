import type { ClockPort } from '@application/ports/clock.port';
import { HostConnection } from '@domain/aggregates/host-connection.aggregate';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import type { HostConnectionRepository } from '@domain/repositories/host-connection.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { HostGrant } from '@domain/value-objects/host-grant.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import { OAuth2Clients } from '@infrastructure/integrations/oauth2-clients';
import type { OAuth2Exchange } from '@infrastructure/integrations/oauth2-exchange';
import { RefreshConnections } from '@infrastructure/integrations/refresh-connections';
import { describe, expect, it, vi } from 'vitest';

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
  TeamConfiguration.read({
    teamId: TEAM,
    repository: Repository.of('acme/api'),
    commit: Commit.of('abc1234'),
    files: [ConfigurationFile.of('.spotlight/integrations/slack.yml', CONFIG)],
    problems: [],
    readAt: NOW,
  });

const nearing = (over: { refreshToken?: string | null } = {}) =>
  HostConnection.rehydrate({
    teamId: TEAM,
    source: SLACK,
    accessToken: 'xoxb-old',
    refreshToken:
      'refreshToken' in over ? (over.refreshToken ?? null) : 'xoxe-old',
    expiresAt: new Date('2026-09-07T10:02:00.000Z'),
    scopes: ['chat:write'],
    handle: 'Acme',
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
      nearingExpiry: async () => due,
      save,
      of: vi.fn(),
      held: vi.fn(),
    } as unknown as HostConnectionRepository,
    { findFor: async () => config() } as unknown as TeamConfigurationRepository,
    new IntegrationReader(),
    OAuth2Clients.from('{"slack":{"id":"c-1","secret":"s-1"}}'),
    { refresh } as unknown as OAuth2Exchange,
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
    expect(saved?.accessToken).toBe('xoxb-new');
  });

  it('leaves one with no refresh token alone', async () => {
    const { it, save, refresh } = refreshing([nearing({ refreshToken: null })]);

    await it.refresh();

    expect(refresh).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps the old token when the host refuses to renew', async () => {
    const { it, save } = refreshing([nearing()], null);

    await it.refresh();

    expect(save).not.toHaveBeenCalled();
  });

  it('does nothing when nothing is near expiry', async () => {
    const { it, refresh } = refreshing([]);

    await it.refresh();

    expect(refresh).not.toHaveBeenCalled();
  });
});
