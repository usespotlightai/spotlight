import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import type { HostConnected } from '@integrations/domain/events/host-connected.event';
import { RenewalClaimedError } from '@integrations/domain/exceptions/renewal-claimed.error';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { RenewalClaim } from '@integrations/domain/value-objects/renewal-claim.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const SLACK = SourceKey.of('slack');
const NOW = new Date('2026-09-07T10:00:00.000Z');

const grant = (over: Partial<Parameters<typeof HostGrant.of>[0]> = {}) =>
  HostGrant.of({
    accessToken: 'xoxb-1',
    refreshToken: 'xoxe-1',
    expiresAt: new Date('2026-09-07T11:00:00.000Z'),
    scopes: ['chat:write'],
    handle: 'Acme',
    ...over,
  });

const rehydrated = (
  over: {
    expiresAt?: Date | null;
    refreshToken?: string | null;
    renewalRefusedAt?: Date | null;
  } = {},
) =>
  HostConnection.rehydrate({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    source: SLACK,
    holder: ConnectionHolder.team(),
    accessToken: AccessToken.of('xoxb-old'),
    refreshToken: AccessToken.maybe(
      'refreshToken' in over ? over.refreshToken : 'xoxe-old',
    ),
    expiresAt: over.expiresAt ?? null,
    scopes: ['chat:write'],
    handle: 'Acme',
    renewalRefusedAt: over.renewalRefusedAt ?? null,
    renewalClaim: null,
    version: 3,
  });

describe('HostConnection', () => {
  it('announces the host was connected when first linked', () => {
    const connection = HostConnection.linkFrom({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TEAM,
      source: SLACK,
      holder: ConnectionHolder.team(),
      grant: grant(),
    });

    expect(connection.pullEvents().map((each) => each.kind)).toEqual([
      'integrations.host-connected',
    ]);
    expect(connection.accessToken.value).toBe('xoxb-1');
    expect(connection.handle).toBe('Acme');
    expect(connection.isNew).toBe(true);
  });

  it('never says its token aloud', () => {
    const connection = rehydrated();

    expect(JSON.stringify({ token: connection.accessToken })).not.toContain(
      'xoxb',
    );
    expect(`${connection.accessToken}`).not.toContain('xoxb');
  });

  it('is not a happening to read one back from where it was kept', () => {
    expect(rehydrated().pullEvents()).toEqual([]);
  });

  it('needs renewal when the token is near its end and can be renewed', () => {
    expect(
      rehydrated({
        expiresAt: new Date('2026-09-07T10:04:00.000Z'),
      }).needsRenewal(NOW),
    ).toBe(true);
  });

  it('needs no renewal while there is comfortable time left', () => {
    expect(
      rehydrated({
        expiresAt: new Date('2026-09-07T11:00:00.000Z'),
      }).needsRenewal(NOW),
    ).toBe(false);
  });

  it('needs no renewal without a way to renew, or without an expiry', () => {
    expect(
      rehydrated({
        expiresAt: new Date('2026-09-07T10:00:30.000Z'),
        refreshToken: null,
      }).needsRenewal(NOW),
    ).toBe(false);
    expect(rehydrated({ expiresAt: null }).needsRenewal(NOW)).toBe(false);
  });

  it('takes the fresh grant when renewed', () => {
    const renewed = rehydrated().renewedWith(
      grant({
        accessToken: 'xoxb-2',
        refreshToken: 'xoxe-2',
        handle: 'Acme 2',
      }),
    );

    expect(renewed.accessToken.value).toBe('xoxb-2');
    expect(renewed.refreshToken?.value).toBe('xoxe-2');
    expect(renewed.handle).toBe('Acme 2');
    expect(renewed.version).toBe(3);
  });

  it('keeps the old refresh token and handle when the host reissues neither', () => {
    const renewed = rehydrated().renewedWith(
      grant({ accessToken: 'xoxb-2', refreshToken: null, handle: null }),
    );

    expect(renewed.refreshToken?.value).toBe('xoxe-old');
    expect(renewed.handle).toBe('Acme');
  });

  it('renewing is the same link kept alive, not a thing to announce', () => {
    expect(rehydrated().renewedWith(grant()).pullEvents()).toEqual([]);
  });

  it('remembers a refused renewal, says so once, and stops asking', () => {
    const expiring = rehydrated({
      expiresAt: new Date('2026-09-07T10:01:00.000Z'),
    });
    const refused = expiring.renewalRefused(NOW);

    expect(refused.pullEvents().map((each) => each.kind)).toEqual([
      'integrations.host-renewal-refused',
    ]);
    expect(refused.renewalRefusedAt).toEqual(NOW);
    expect(refused.needsRenewal(NOW)).toBe(false);
    expect(refused.renewalRefused(NOW).pullEvents()).toEqual([]);
  });

  it('refuses to be read back without a version', () => {
    expect(() =>
      HostConnection.rehydrate({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TEAM,
        source: SLACK,
        holder: ConnectionHolder.team(),
        accessToken: AccessToken.of('x'),
        refreshToken: null,
        expiresAt: null,
        scopes: [],
        handle: null,
        renewalRefusedAt: null,
        renewalClaim: null,
        version: 0,
      }),
    ).toThrow();
  });

  it('announces whose connection it is, and in which workspace', () => {
    const [connected] = HostConnection.linkFrom({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TEAM,
      source: SLACK,
      holder: ConnectionHolder.person(UserId.of('user_1')),
      grant: grant(),
    }).pullEvents() as HostConnected[];

    expect(connected?.holder.personId?.value).toBe('user_1');
    expect(connected?.workspaceId.value).toBe('ws_1');
  });

  it('is a different connection for each holder of the same host', () => {
    const team = rehydrated();
    const alice = HostConnection.linkFrom({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TEAM,
      source: SLACK,
      holder: ConnectionHolder.person(UserId.of('user_1')),
      grant: grant(),
    });

    expect(team.equals(alice)).toBe(false);
  });

  it('is claimed for renewal by one caller until the lease runs out', () => {
    const claimed = rehydrated().claimRenewal(NOW, 30_000);

    expect(claimed.isClaimedAt(NOW)).toBe(true);
    expect(() => claimed.claimRenewal(NOW, 30_000)).toThrow(
      RenewalClaimedError,
    );
    expect(claimed.isClaimedAt(new Date(NOW.getTime() + 30_000))).toBe(false);
    expect(
      claimed
        .claimRenewal(new Date(NOW.getTime() + 30_000), 30_000)
        .isClaimedAt(new Date(NOW.getTime() + 30_001)),
    ).toBe(true);
  });

  it('needs no renewal while someone else is renewing it', () => {
    const near = rehydrated({
      expiresAt: new Date('2026-09-07T10:04:00.000Z'),
    });

    expect(near.claimRenewal(NOW, 30_000).needsRenewal(NOW)).toBe(false);
  });

  it('cannot be claimed without a way to renew', () => {
    expect(() =>
      rehydrated({ refreshToken: null }).claimRenewal(NOW, 30_000),
    ).toThrow();
  });

  it('lets go of the claim once renewed, refused or released', () => {
    const claimed = rehydrated().claimRenewal(NOW, 30_000);

    expect(claimed.renewedWith(grant()).isClaimedAt(NOW)).toBe(false);
    expect(claimed.renewalRefused(NOW).isClaimedAt(NOW)).toBe(false);
    expect(claimed.renewalReleased().isClaimedAt(NOW)).toBe(false);
  });

  it('knows whether the token a host refused is still the one it has', () => {
    const connection = rehydrated();

    expect(connection.refusedToken(AccessToken.of('xoxb-old'))).toBe(true);
    expect(
      connection
        .renewedWith(grant({ accessToken: 'xoxb-2' }))
        .refusedToken(AccessToken.of('xoxb-old')),
    ).toBe(false);
  });

  it('is unusable once its renewal was refused', () => {
    expect(rehydrated().usable).toBe(true);
    expect(rehydrated().renewalRefused(NOW).usable).toBe(false);
  });

  it('announces it was disconnected', () => {
    expect(
      rehydrated()
        .disconnect()
        .pullEvents()
        .map((each) => each.kind),
    ).toEqual(['integrations.host-disconnected']);
  });

  it('refuses to be read back claimed without a way to renew', () => {
    expect(() =>
      HostConnection.rehydrate({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TEAM,
        source: SLACK,
        holder: ConnectionHolder.team(),
        accessToken: AccessToken.of('x'),
        refreshToken: null,
        expiresAt: null,
        scopes: [],
        handle: null,
        renewalRefusedAt: null,
        renewalClaim: RenewalClaim.until(NOW),
        version: 1,
      }),
    ).toThrow();
  });
});
