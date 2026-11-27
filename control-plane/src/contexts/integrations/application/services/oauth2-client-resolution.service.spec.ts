import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { OAuth2ClientResolution } from '@integrations/application/services/oauth2-client-resolution.service';
import type { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuth2ClientId } from '@integrations/domain/value-objects/oauth2-client-id.vo';
import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');
const TRACKER = IntegrationKey.of('tracker');
const REGISTRATION = 'https://auth.tracker.example/register';

const server = (token = 'https://auth.tracker.example/token') =>
  AuthorizationServer.of({
    issuer: 'https://auth.tracker.example',
    authorize: 'https://auth.tracker.example/authorize',
    token,
  });

const resolving = (configured = '{}') => {
  let stored: OAuth2ClientRegistration | null = null;
  let registered = 0;
  const register = vi.fn<
    () => Promise<{
      clientId: OAuth2ClientId;
      clientSecret: null;
      secretExpiresAt: null;
    } | null>
  >(async () => ({
    clientId: OAuth2ClientId.of(`client-${(registered += 1)}`),
    clientSecret: null,
    secretExpiresAt: null,
  }));
  const sentTo = vi.fn(
    async (_workspace: WorkspaceId, secret: SecretName, _url: string) =>
      secret.value === 'TRACKER_CLIENT_SECRET' ? 'own-secret' : 'other',
  );
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } satisfies LoggerPort;
  const clients = new OAuth2ClientResolution(
    OAuth2Clients.from(configured),
    {
      of: async () => stored,
      save: async (registration: OAuth2ClientRegistration) => {
        stored = registration;
      },
      ofTeam: async () => [],
      remove: async () => {},
    },
    { register },
    {
      find: async (id: TeamId) => ({
        id,
        workspaceId: WorkspaceId.of('ws_1'),
        key: 'platform',
        name: 'Platform',
        members: [],
      }),
      inWorkspace: async () => [],
    } satisfies TeamDirectoryPort,
    partial<ClockPort>({ now: () => new Date('2026-10-05T10:00:00.000Z') }),
    'https://app.example/api/integrations/oauth/callback',
    logger,
    { sentTo },
  );

  return { clients, register, logger, sentTo };
};

const OWN = {
  id: 'own-client',
  secret: SecretName.of('TRACKER_CLIENT_SECRET'),
  token: 'https://tracker.example/oauth/token',
};

describe('OAuth2ClientResolution', () => {
  it('uses the team’s own client before a configured one or a registration', async () => {
    const { clients, register, sentTo, logger } = resolving(
      '{"tracker":{"id":"c-1","secret":"s-1"}}',
    );
    const own = { id: 'own-client', secret: 'own-secret' };

    await expect(
      clients.clientFor(TEAM, TRACKER, {
        own: OWN,
        endpoint: REGISTRATION,
        server: server(),
      }),
    ).resolves.toEqual(own);
    await expect(
      clients.existingFor(TEAM, TRACKER, { own: OWN, server: null }),
    ).resolves.toEqual(own);
    expect(sentTo).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      SecretName.of('TRACKER_CLIENT_SECRET'),
      'https://tracker.example/oauth/token',
    );
    expect(register).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('reads no secret for a team’s own public client', async () => {
    const { clients, sentTo } = resolving();

    await expect(
      clients.clientFor(TEAM, TRACKER, {
        own: {
          id: 'public-client',
          secret: null,
          token: 'https://tracker.example/oauth/token',
        },
        endpoint: null,
        server: null,
      }),
    ).resolves.toEqual({ id: 'public-client', secret: null });
    expect(sentTo).not.toHaveBeenCalled();
  });

  it('uses a client registered with one authorization server only for that server', async () => {
    const { clients } = resolving();

    await expect(
      clients.clientFor(TEAM, TRACKER, {
        own: null,
        endpoint: REGISTRATION,
        server: server(),
      }),
    ).resolves.toEqual({ id: 'client-1', secret: null });
    await expect(
      clients.existingFor(TEAM, TRACKER, { own: null, server: server() }),
    ).resolves.toEqual({
      id: 'client-1',
      secret: null,
    });
    await expect(
      clients.existingFor(TEAM, TRACKER, {
        own: null,
        server: server('https://evil.example/token'),
      }),
    ).resolves.toBeNull();
    await expect(
      clients.existingFor(TEAM, TRACKER, { own: null, server: null }),
    ).resolves.toBeNull();
  });

  it('registers again when the server discovered moved', async () => {
    const { clients, register } = resolving();

    await clients.clientFor(TEAM, TRACKER, {
      own: null,
      endpoint: REGISTRATION,
      server: server(),
    });
    await clients.clientFor(TEAM, TRACKER, {
      own: null,
      endpoint: REGISTRATION,
      server: server('https://auth.tracker.example/v2/token'),
    });

    expect(register).toHaveBeenCalledTimes(2);
  });

  it('uses a configured client for a discovered server only when it names the same issuer', async () => {
    const bound = resolving(
      '{"tracker":{"id":"c-1","secret":"s-1","issuer":"https://auth.tracker.example"}}',
    );
    const unbound = resolving('{"tracker":{"id":"c-1","secret":"s-1"}}');

    await expect(
      bound.clients.clientFor(TEAM, TRACKER, {
        own: null,
        endpoint: REGISTRATION,
        server: server(),
      }),
    ).resolves.toEqual({ id: 'c-1', secret: 's-1' });
    expect(bound.logger.warn).not.toHaveBeenCalled();
    await expect(
      unbound.clients.clientFor(TEAM, TRACKER, {
        own: null,
        endpoint: REGISTRATION,
        server: server(),
      }),
    ).rejects.toMatchObject({
      kind: 'invalid',
      message:
        'Integration tracker has no OAuth2 client for its authorization server.',
    });
    expect(unbound.logger.warn).toHaveBeenCalledExactlyOnceWith(
      {
        integration: 'tracker',
        named: null,
        required: 'https://auth.tracker.example',
      },
      'OAUTH_CLIENTS entry names an issuer other than the authorization server',
    );
    await expect(
      unbound.clients.existingFor(TEAM, TRACKER, { own: null, server: null }),
    ).resolves.toEqual({ id: 'c-1', secret: 's-1' });
    expect(unbound.register).not.toHaveBeenCalled();
  });

  it('refuses, and asks operators for an OAUTH_CLIENTS entry, where the integration offers no registration', async () => {
    const { clients, register, logger } = resolving();

    await expect(
      clients.clientFor(TEAM, TRACKER, {
        own: null,
        endpoint: null,
        server: server(),
      }),
    ).rejects.toMatchObject({
      kind: 'invalid',
      message: 'Integration tracker has no OAuth2 client.',
    });
    expect(register).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      { integration: 'tracker', named: undefined, required: undefined },
      'No OAUTH_CLIENTS entry for the integration',
    );
  });

  it('says so where the registration endpoint registers no client', async () => {
    const { clients, register } = resolving();
    register.mockResolvedValueOnce(null);

    await expect(
      clients.clientFor(TEAM, TRACKER, {
        own: null,
        endpoint: REGISTRATION,
        server: server(),
      }),
    ).rejects.toMatchObject({
      kind: 'upstream-error',
      message: 'Client registration for integration tracker failed.',
    });
  });
});
