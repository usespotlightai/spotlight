import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { IntegrationConnected } from '@integrations/domain/events/integration-connected.event';
import { RefreshClaimedError } from '@integrations/domain/exceptions/refresh-claimed.error';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import { RefreshClaim } from '@integrations/domain/value-objects/refresh-claim.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const SLACK = IntegrationKey.of('slack');
const NOW = new Date('2026-09-07T10:00:00.000Z');

const tokens = (over: Partial<Parameters<typeof OAuthTokens.of>[0]> = {}) =>
  OAuthTokens.of({
    accessToken: 'xoxb-1',
    refreshToken: 'xoxe-1',
    expiresAt: new Date('2026-09-07T11:00:00.000Z'),
    scopes: ['chat:write'],
    linkedAccount: 'Acme',
    ...over,
  });

const rehydrated = (
  over: {
    expiresAt?: Date | null;
    refreshToken?: string | null;
    refreshFailedAt?: Date | null;
  } = {},
) =>
  IntegrationConnection.rehydrate({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    integration: SLACK,
    owner: ConnectionOwner.team(),
    accessToken: AccessToken.of('xoxb-old'),
    refreshToken: AccessToken.maybe(
      'refreshToken' in over ? over.refreshToken : 'xoxe-old',
    ),
    expiresAt: over.expiresAt ?? null,
    scopes: ['chat:write'],
    linkedAccount: 'Acme',
    refreshFailedAt: over.refreshFailedAt ?? null,
    refreshClaim: null,
    version: 3,
  });

describe('IntegrationConnection', () => {
  it('announces the integration was connected when first connected', () => {
    const connection = IntegrationConnection.connectFrom({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TEAM,
      integration: SLACK,
      owner: ConnectionOwner.team(),
      tokens: tokens(),
    });

    expect(connection.pullEvents().map((each) => each.kind)).toEqual([
      'integrations.integration-connected',
    ]);
    expect(connection.accessToken.value).toBe('xoxb-1');
    expect(connection.linkedAccount).toBe('Acme');
    expect(connection.isNew).toBe(true);
  });

  it('never says its token aloud', () => {
    const connection = rehydrated();

    expect(JSON.stringify({ token: connection.accessToken })).not.toContain(
      'xoxb',
    );
    expect(`${connection.accessToken}`).not.toContain('xoxb');
  });

  it('is not a happening to read one back from where it was stored', () => {
    expect(rehydrated().pullEvents()).toEqual([]);
  });

  it('needs a refresh when the token is near its end and can be refreshed', () => {
    expect(
      rehydrated({
        expiresAt: new Date('2026-09-07T10:04:00.000Z'),
      }).needsRefresh(NOW),
    ).toBe(true);
  });

  it('needs no refresh while there is comfortable time left', () => {
    expect(
      rehydrated({
        expiresAt: new Date('2026-09-07T11:00:00.000Z'),
      }).needsRefresh(NOW),
    ).toBe(false);
  });

  it('needs no refresh without a refresh token, or without an expiry', () => {
    expect(
      rehydrated({
        expiresAt: new Date('2026-09-07T10:00:30.000Z'),
        refreshToken: null,
      }).needsRefresh(NOW),
    ).toBe(false);
    expect(rehydrated({ expiresAt: null }).needsRefresh(NOW)).toBe(false);
  });

  it('takes the fresh tokens when refreshed', () => {
    const refreshed = rehydrated().refreshedWith(
      tokens({
        accessToken: 'xoxb-2',
        refreshToken: 'xoxe-2',
        linkedAccount: 'Acme 2',
      }),
    );

    expect(refreshed.accessToken.value).toBe('xoxb-2');
    expect(refreshed.refreshToken?.value).toBe('xoxe-2');
    expect(refreshed.linkedAccount).toBe('Acme 2');
    expect(refreshed.version).toBe(3);
  });

  it('keeps the old refresh token and linked account when the service reissues neither', () => {
    const refreshed = rehydrated().refreshedWith(
      tokens({
        accessToken: 'xoxb-2',
        refreshToken: null,
        linkedAccount: null,
      }),
    );

    expect(refreshed.refreshToken?.value).toBe('xoxe-old');
    expect(refreshed.linkedAccount).toBe('Acme');
  });

  it('a refresh keeps the same connection alive and announces nothing', () => {
    expect(rehydrated().refreshedWith(tokens()).pullEvents()).toEqual([]);
  });

  it('remembers a failed refresh, says so once, and stops trying', () => {
    const expiring = rehydrated({
      expiresAt: new Date('2026-09-07T10:01:00.000Z'),
    });
    const failed = expiring.refreshFailed(NOW);

    expect(failed.pullEvents().map((each) => each.kind)).toEqual([
      'integrations.connection-refresh-failed',
    ]);
    expect(failed.refreshFailedAt).toEqual(NOW);
    expect(failed.needsRefresh(NOW)).toBe(false);
    expect(failed.refreshFailed(NOW).pullEvents()).toEqual([]);
  });

  it('cannot be read back without a version', () => {
    expect(() =>
      IntegrationConnection.rehydrate({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TEAM,
        integration: SLACK,
        owner: ConnectionOwner.team(),
        accessToken: AccessToken.of('x'),
        refreshToken: null,
        expiresAt: null,
        scopes: [],
        linkedAccount: null,
        refreshFailedAt: null,
        refreshClaim: null,
        version: 0,
      }),
    ).toThrow();
  });

  it('announces whose connection it is, and in which workspace', () => {
    const [connected] = IntegrationConnection.connectFrom({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TEAM,
      integration: SLACK,
      owner: ConnectionOwner.person(UserId.of('user_1')),
      tokens: tokens(),
    }).pullEvents() as IntegrationConnected[];

    expect(connected?.owner.personId?.value).toBe('user_1');
    expect(connected?.workspaceId.value).toBe('ws_1');
  });

  it('is a different connection for each owner of the same integration', () => {
    const team = rehydrated();
    const alice = IntegrationConnection.connectFrom({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TEAM,
      integration: SLACK,
      owner: ConnectionOwner.person(UserId.of('user_1')),
      tokens: tokens(),
    });

    expect(team.equals(alice)).toBe(false);
  });

  it('is claimed for refresh by one caller until the lease runs out', () => {
    const claimed = rehydrated().claimRefresh(NOW, 30_000);

    expect(claimed.isClaimedAt(NOW)).toBe(true);
    expect(() => claimed.claimRefresh(NOW, 30_000)).toThrow(
      RefreshClaimedError,
    );
    expect(claimed.isClaimedAt(new Date(NOW.getTime() + 30_000))).toBe(false);
    expect(
      claimed
        .claimRefresh(new Date(NOW.getTime() + 30_000), 30_000)
        .isClaimedAt(new Date(NOW.getTime() + 30_001)),
    ).toBe(true);
  });

  it('needs no refresh while someone else refreshes it', () => {
    const near = rehydrated({
      expiresAt: new Date('2026-09-07T10:04:00.000Z'),
    });

    expect(near.claimRefresh(NOW, 30_000).needsRefresh(NOW)).toBe(false);
  });

  it('cannot be claimed without a refresh token', () => {
    expect(() =>
      rehydrated({ refreshToken: null }).claimRefresh(NOW, 30_000),
    ).toThrow();
  });

  it('drops the claim once refreshed, failed or released', () => {
    const claimed = rehydrated().claimRefresh(NOW, 30_000);

    expect(claimed.refreshedWith(tokens()).isClaimedAt(NOW)).toBe(false);
    expect(claimed.refreshFailed(NOW).isClaimedAt(NOW)).toBe(false);
    expect(claimed.refreshReleased().isClaimedAt(NOW)).toBe(false);
  });

  it('knows whether the token the service did not accept is still the one it has', () => {
    const connection = rehydrated();

    expect(connection.hasToken(AccessToken.of('xoxb-old'))).toBe(true);
    expect(
      connection
        .refreshedWith(tokens({ accessToken: 'xoxb-2' }))
        .hasToken(AccessToken.of('xoxb-old')),
    ).toBe(false);
  });

  it('is unusable once its refresh failed', () => {
    expect(rehydrated().usable).toBe(true);
    expect(rehydrated().refreshFailed(NOW).usable).toBe(false);
  });

  it('announces it was disconnected', () => {
    expect(
      rehydrated()
        .disconnect()
        .pullEvents()
        .map((each) => each.kind),
    ).toEqual(['integrations.integration-disconnected']);
  });

  it('cannot be read back claimed without a refresh token', () => {
    expect(() =>
      IntegrationConnection.rehydrate({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TEAM,
        integration: SLACK,
        owner: ConnectionOwner.team(),
        accessToken: AccessToken.of('x'),
        refreshToken: null,
        expiresAt: null,
        scopes: [],
        linkedAccount: null,
        refreshFailedAt: null,
        refreshClaim: RefreshClaim.until(NOW),
        version: 1,
      }),
    ).toThrow();
  });
});
