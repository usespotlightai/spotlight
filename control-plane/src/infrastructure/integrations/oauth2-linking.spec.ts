import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import { Factory } from '@domain/aggregates/factory.aggregate';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HostGrant } from '@domain/value-objects/host-grant.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import { OAuth2Clients } from '@infrastructure/integrations/oauth2-clients';
import type { OAuth2Exchange } from '@infrastructure/integrations/oauth2-exchange';
import { OAuth2Linking } from '@infrastructure/integrations/oauth2-linking';
import { OAuth2State } from '@infrastructure/integrations/oauth2-state';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');
const BASE = 'https://app.example';

const SLACK = `
version: 1
integration: slack
connection:
  oauth2:
    authorize: https://slack.com/oauth/authorize
    token: https://slack.com/api/oauth.v2.access
    scopes:
      - chat:write
      - channels:read
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
    files: [ConfigurationFile.of('.spotlight/integrations/slack.yml', SLACK)],
    problems: [],
    readAt: new Date('2026-09-07T10:00:00.000Z'),
  });

const GRANT = HostGrant.of({
  accessToken: 'xoxb-1',
  refreshToken: 'xoxe-1',
  expiresAt: null,
  scopes: ['chat:write'],
  handle: 'Acme',
});

const linking = (
  over: { clients?: string; exchanged?: HostGrant | null } = {},
) => {
  const exchanged = 'exchanged' in over ? over.exchanged : GRANT;
  const exchange = vi.fn(async () => exchanged);

  const it = new OAuth2Linking(
    { findFor: async () => config() } as unknown as TeamConfigurationRepository,
    new IntegrationReader(),
    OAuth2Clients.from(over.clients ?? '{"slack":{"id":"c-1","secret":"s-1"}}'),
    { exchange } as unknown as OAuth2Exchange,
    {
      ofTeam: async () =>
        Factory.of({
          id: FactoryId.of('factory_1'),
          workspaceId: WorkspaceId.of('ws_1'),
          teamId: TEAM,
        }),
    } as unknown as FactoryRepository,
    { slugOf: async () => 'acme' } as unknown as WorkspaceReaderPort,
    new OAuth2State('a-secret'),
    BASE,
  );

  return { it, exchange };
};

const signed = (source = 'slack', by = 'user_1') =>
  new OAuth2State('a-secret').sign({ teamId: 'team_1', source, by });

describe('OAuth2Linking', () => {
  it('builds an authorize URL with the app, the callback, the scopes and a state', async () => {
    const { it } = linking();

    const url = new URL((await it.begin('team_1', 'slack', 'user_1')) ?? '');

    expect(url.origin + url.pathname).toBe('https://slack.com/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('c-1');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.example/integrations/oauth/callback',
    );
    expect(url.searchParams.get('scope')).toBe('chat:write channels:read');
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('will not begin where the deployment registered no app for the host', async () => {
    const { it } = linking({ clients: '{}' });

    expect(await it.begin('team_1', 'slack', 'user_1')).toBeNull();
  });

  it('will not begin for a host the team does not link this way', async () => {
    const { it } = linking();

    expect(await it.begin('team_1', 'linear', 'user_1')).toBeNull();
  });

  it('turns a returning code into a grant, with who signed it', async () => {
    const { it, exchange } = linking();

    const authorized = await it.authorized(signed(), 'the-code');

    expect(exchange).toHaveBeenCalledOnce();
    expect(authorized?.teamId).toBe('team_1');
    expect(authorized?.source).toBe('slack');
    expect(authorized?.by).toBe('user_1');
    expect(authorized?.grant.accessToken).toBe('xoxb-1');
  });

  it('refuses a state it did not sign', async () => {
    const { it, exchange } = linking();
    const forged = new OAuth2State('another-secret').sign({
      teamId: 'team_1',
      source: 'slack',
      by: 'user_1',
    });

    expect(await it.authorized(forged, 'the-code')).toBeNull();
    expect(exchange).not.toHaveBeenCalled();
  });

  it('yields nothing when the host refuses the code', async () => {
    const { it } = linking({ exchanged: null });

    expect(await it.authorized(signed(), 'bad-code')).toBeNull();
  });

  it('sends the browser back to where the link began', async () => {
    const { it } = linking();

    expect(await it.landingFor('team_1', 'slack')).toBe(
      'https://app.example/w/acme/team/team_1/integrations?connected=slack',
    );
  });
});
