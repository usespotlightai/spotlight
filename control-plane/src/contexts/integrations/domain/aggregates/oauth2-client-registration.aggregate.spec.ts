import { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-05T10:00:00.000Z');
const SERVER = AuthorizationServer.of({
  issuer: 'https://mcp.example',
  authorize: 'https://mcp.example/authorize',
  token: 'https://mcp.example/token',
});
const WANTED = {
  registrationEndpoint: 'https://mcp.example/register',
  redirectUri: 'https://app.example/api/integrations/oauth/callback',
  server: SERVER,
};

const registered = (secretExpiresAt: Date | null = null) =>
  OAuth2ClientRegistration.register({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    source: SourceKey.of('notion'),
    ...WANTED,
    clientId: 'client-1',
    clientSecret: AccessToken.of('secret-1'),
    secretExpiresAt,
  });

describe('OAuth2ClientRegistration', () => {
  it('fits the endpoint and callback it was registered for', () => {
    expect(registered().fits(WANTED, NOW)).toBe(true);
  });

  it('does not fit once the callback moved or the endpoint changed', () => {
    expect(
      registered().fits(
        { ...WANTED, redirectUri: 'https://elsewhere.example/callback' },
        NOW,
      ),
    ).toBe(false);
    expect(
      registered().fits(
        { ...WANTED, registrationEndpoint: 'https://mcp.example/v2/register' },
        NOW,
      ),
    ).toBe(false);
  });

  it('does not fit, nor serve, another authorization server than the one it was registered with', () => {
    const moved = AuthorizationServer.of({
      issuer: 'https://mcp.example',
      authorize: 'https://mcp.example/authorize',
      token: 'https://evil.example/token',
    });

    expect(registered().fits({ ...WANTED, server: moved }, NOW)).toBe(false);
    expect(registered().servedBy(moved)).toBe(false);
    expect(registered().servedBy(null)).toBe(false);
    expect(registered().servedBy(SERVER)).toBe(true);
  });

  it('does not fit once its secret expired', () => {
    expect(
      registered(new Date('2026-10-05T09:59:59.000Z')).fits(WANTED, NOW),
    ).toBe(false);
    expect(
      registered(new Date('2026-10-05T10:00:01.000Z')).fits(WANTED, NOW),
    ).toBe(true);
  });

  it('is replaced in place by a registration for the same integration', () => {
    const stored = OAuth2ClientRegistration.rehydrate({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      source: SourceKey.of('notion'),
      ...WANTED,
      clientId: 'client-0',
      clientSecret: null,
      secretExpiresAt: null,
      version: 2,
    });
    const replaced = stored.replaceWith(registered());

    expect(replaced.clientId).toBe('client-1');
    expect(replaced.version).toBe(2);
  });

  it('rejects an answer without a client id', () => {
    expect(() =>
      OAuth2ClientRegistration.register({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        source: SourceKey.of('notion'),
        ...WANTED,
        clientId: ' ',
        clientSecret: null,
        secretExpiresAt: null,
      }),
    ).toThrow();
  });

  it('never says its secret aloud', () => {
    expect(JSON.stringify({ secret: registered().clientSecret })).not.toContain(
      'secret-1',
    );
  });
});
