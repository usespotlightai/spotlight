import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { OAuth2NoncesPort } from '@integrations/application/ports/oauth2-nonces.port';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import { OAuth2Linking } from '@integrations/infrastructure/integrations/oauth2-linking';
import { OAuth2State } from '@integrations/infrastructure/integrations/oauth2-state';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const expressions = new CelExpressionEngine();

const TEAM = TeamId.of('team_1');
const BASE = 'https://app.example';

const SLACK = `
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

const config = () => [defined(SLACK)];

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
  const spent = new Set<string>();
  const nonces: OAuth2NoncesPort = {
    spend: async (nonce) => {
      if (spent.has(nonce)) {
        return false;
      }
      spent.add(nonce);
      return true;
    },
  };

  const it = new OAuth2Linking(
    { ofTeam: async () => config() } as unknown as DefinedIntegrationsPort,
    new IntegrationReader(expressions),
    OAuth2Clients.from(over.clients ?? '{"slack":{"id":"c-1","secret":"s-1"}}'),
    { exchange } as unknown as OAuth2Exchange,
    {
      find: async () => ({
        id: TEAM,
        workspaceId: WorkspaceId.of('ws_1'),
        name: 'Platform',
        members: [],
      }),
    } as unknown as TeamDirectoryPort,
    { slugOf: async () => 'acme' } as unknown as WorkspaceReaderPort,
    new OAuth2State('a-secret'),
    nonces,
    { now: () => new Date() } as ClockPort,
    BASE,
    `${BASE}/api/integrations/oauth/callback`,
  );

  return { it, exchange };
};

const signed = (source = 'slack', by = 'user_1', nonce = 'n-1') =>
  new OAuth2State('a-secret').sign({ teamId: 'team_1', source, by, nonce })
    .token;

const returned = (
  over: {
    state?: string;
    nonce?: string | null;
    viewerId?: string | null;
  } = {},
) => ({
  state: over.state ?? signed(),
  code: 'the-code',
  nonce: 'nonce' in over ? (over.nonce ?? null) : 'n-1',
  viewerId: 'viewerId' in over ? (over.viewerId ?? null) : 'user_1',
});

describe('OAuth2Linking', () => {
  it('builds an authorize URL with the app, the callback, the scopes and a state', async () => {
    const { it } = linking();

    const begun = await it.begin('team_1', 'slack', 'user_1');
    const url = new URL(begun?.url ?? '');

    expect(url.origin + url.pathname).toBe('https://slack.com/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('c-1');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.example/api/integrations/oauth/callback',
    );
    expect(url.searchParams.get('scope')).toBe('chat:write channels:read');
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('binds the state to a fresh nonce for the browser that began', async () => {
    const { it } = linking();

    const one = await it.begin('team_1', 'slack', 'user_1');
    const other = await it.begin('team_1', 'slack', 'user_1');
    const state = new URL(one?.url ?? '').searchParams.get('state') ?? '';

    expect(one?.nonce).toBeTruthy();
    expect(one?.nonce).not.toBe(other?.nonce);
    expect(new OAuth2State('a-secret').open(state)?.nonce).toBe(one?.nonce);
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

    const authorized = await it.authorized(returned());

    expect(exchange).toHaveBeenCalledOnce();
    expect(authorized?.teamId).toBe('team_1');
    expect(authorized?.source).toBe('slack');
    expect(authorized?.by).toBe('user_1');
    expect(authorized?.grant.accessToken.value).toBe('xoxb-1');
  });

  it('refuses a state it did not sign', async () => {
    const { it, exchange } = linking();
    const forged = new OAuth2State('another-secret').sign({
      teamId: 'team_1',
      source: 'slack',
      by: 'user_1',
      nonce: 'n-1',
    }).token;

    expect(await it.authorized(returned({ state: forged }))).toBeNull();
    expect(exchange).not.toHaveBeenCalled();
  });

  it('yields nothing when the host refuses the code', async () => {
    const { it } = linking({ exchanged: null });

    expect(await it.authorized(returned())).toBeNull();
  });

  it('refuses a browser whose nonce cookie is not the one the state carries', async () => {
    const { it, exchange } = linking();

    expect(await it.authorized(returned({ nonce: 'n-2' }))).toBeNull();
    expect(exchange).not.toHaveBeenCalled();
  });

  it('refuses a browser that brought no nonce cookie', async () => {
    const { it, exchange } = linking();

    expect(await it.authorized(returned({ nonce: null }))).toBeNull();
    expect(exchange).not.toHaveBeenCalled();
  });

  it('refuses a session that is not the person who began', async () => {
    const { it, exchange } = linking();

    expect(await it.authorized(returned({ viewerId: 'user_2' }))).toBeNull();
    expect(await it.authorized(returned({ viewerId: null }))).toBeNull();
    expect(exchange).not.toHaveBeenCalled();
  });

  it('refuses a state that has already been returned once', async () => {
    const { it, exchange } = linking();

    expect(await it.authorized(returned())).not.toBeNull();
    expect(await it.authorized(returned())).toBeNull();
    expect(exchange).toHaveBeenCalledOnce();
  });

  it('sends the browser back to where the link began', async () => {
    const { it } = linking();

    expect(await it.landingFor('team_1', 'slack')).toBe(
      'https://app.example/w/acme/team/team_1/settings/integrations?connected=slack',
    );
  });
});
