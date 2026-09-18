import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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
    teamId: TEAM,
    source: SLACK,
    accessToken: AccessToken.of('xoxb-old'),
    refreshToken: AccessToken.maybe(
      'refreshToken' in over ? over.refreshToken : 'xoxe-old',
    ),
    expiresAt: over.expiresAt ?? null,
    scopes: ['chat:write'],
    handle: 'Acme',
    renewalRefusedAt: over.renewalRefusedAt ?? null,
    version: 3,
  });

describe('HostConnection', () => {
  it('announces the host was connected when first linked', () => {
    const connection = HostConnection.linkedFrom({
      teamId: TEAM,
      source: SLACK,
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
        teamId: TEAM,
        source: SLACK,
        accessToken: AccessToken.of('x'),
        refreshToken: null,
        expiresAt: null,
        scopes: [],
        handle: null,
        renewalRefusedAt: null,
        version: 0,
      }),
    ).toThrow();
  });
});
