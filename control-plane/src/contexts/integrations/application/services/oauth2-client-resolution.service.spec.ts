import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { OAuth2ClientRegistrarPort } from '@integrations/application/ports/oauth2-client-registrar.port';
import { OAuth2ClientResolution } from '@integrations/application/services/oauth2-client-resolution.service';
import type { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
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
  const register = vi.fn(async () => ({
    clientId: `client-${register.mock.calls.length}`,
    clientSecret: null,
    secretExpiresAt: null,
  }));
  const clients = new OAuth2ClientResolution(
    OAuth2Clients.from(configured),
    {
      of: async () => stored,
      save: async (registration: OAuth2ClientRegistration) => {
        stored = registration;
      },
      deleteForTeam: async () => {},
    } as OAuth2ClientRegistrationRepository,
    { register } as OAuth2ClientRegistrarPort,
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
    { now: () => new Date('2026-10-05T10:00:00.000Z') } as ClockPort,
    'https://app.example/api/integrations/oauth/callback',
  );

  return { clients, register };
};

describe('OAuth2ClientResolution', () => {
  it('uses a client registered with one authorization server only for that server', async () => {
    const { clients } = resolving();

    await expect(
      clients.clientFor(TEAM, TRACKER, REGISTRATION, server()),
    ).resolves.toEqual({ id: 'client-1', secret: null });
    await expect(clients.existingFor(TEAM, TRACKER, server())).resolves.toEqual(
      {
        id: 'client-1',
        secret: null,
      },
    );
    await expect(
      clients.existingFor(TEAM, TRACKER, server('https://evil.example/token')),
    ).resolves.toBeNull();
    await expect(clients.existingFor(TEAM, TRACKER, null)).resolves.toBeNull();
  });

  it('registers again when the server discovered moved', async () => {
    const { clients, register } = resolving();

    await clients.clientFor(TEAM, TRACKER, REGISTRATION, server());
    await clients.clientFor(
      TEAM,
      TRACKER,
      REGISTRATION,
      server('https://auth.tracker.example/v2/token'),
    );

    expect(register).toHaveBeenCalledTimes(2);
  });

  it('uses a configured client for a discovered server only when it names the same issuer', async () => {
    const bound = resolving(
      '{"tracker":{"id":"c-1","secret":"s-1","issuer":"https://auth.tracker.example"}}',
    );
    const unbound = resolving('{"tracker":{"id":"c-1","secret":"s-1"}}');

    await expect(
      bound.clients.clientFor(TEAM, TRACKER, REGISTRATION, server()),
    ).resolves.toEqual({ id: 'c-1', secret: 's-1' });
    await expect(
      unbound.clients.clientFor(TEAM, TRACKER, REGISTRATION, server()),
    ).resolves.toBeNull();
    await expect(
      unbound.clients.existingFor(TEAM, TRACKER, null),
    ).resolves.toEqual({ id: 'c-1', secret: 's-1' });
    expect(unbound.register).not.toHaveBeenCalled();
  });
});
