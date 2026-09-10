import { HostConnection } from '@domain/aggregates/host-connection.aggregate';
import { HostGrant } from '@domain/value-objects/host-grant.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
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
  over: { expiresAt?: Date | null; refreshToken?: string | null } = {},
) =>
  HostConnection.rehydrate({
    teamId: TEAM,
    source: SLACK,
    accessToken: 'xoxb-old',
    refreshToken:
      'refreshToken' in over ? (over.refreshToken ?? null) : 'xoxe-old',
    expiresAt: over.expiresAt ?? null,
    scopes: ['chat:write'],
    handle: 'Acme',
  });

describe('HostConnection', () => {
  it('announces the host was connected when first linked', () => {
    const connection = HostConnection.linkedFrom({
      teamId: TEAM,
      source: SLACK,
      grant: grant(),
    });

    expect(connection.pullEvents().map((each) => each.kind)).toEqual([
      'host.connected',
    ]);
    expect(connection.accessToken).toBe('xoxb-1');
    expect(connection.handle).toBe('Acme');
  });

  it('is not a happening to read one back from where it was kept', () => {
    expect(rehydrated().pullEvents()).toEqual([]);
  });

  it('is expiring when the token is near its end and can be renewed', () => {
    const soon = rehydrated({
      expiresAt: new Date('2026-09-07T10:00:30.000Z'),
    });

    expect(soon.isExpiring(NOW, 60_000)).toBe(true);
  });

  it('is not expiring while there is comfortable time left', () => {
    const later = rehydrated({
      expiresAt: new Date('2026-09-07T11:00:00.000Z'),
    });

    expect(later.isExpiring(NOW, 60_000)).toBe(false);
  });

  it('is never expiring without a way to renew, since nearness changes nothing', () => {
    const soon = rehydrated({
      expiresAt: new Date('2026-09-07T10:00:30.000Z'),
      refreshToken: null,
    });

    expect(soon.isExpiring(NOW, 60_000)).toBe(false);
  });

  it('is never expiring without an expiry', () => {
    expect(rehydrated({ expiresAt: null }).isExpiring(NOW, 60_000)).toBe(false);
  });

  it('takes the fresh grant when renewed', () => {
    const renewed = rehydrated().renewedWith(
      grant({
        accessToken: 'xoxb-2',
        refreshToken: 'xoxe-2',
        handle: 'Acme 2',
      }),
    );

    expect(renewed.accessToken).toBe('xoxb-2');
    expect(renewed.refreshToken).toBe('xoxe-2');
    expect(renewed.handle).toBe('Acme 2');
  });

  it('keeps the old refresh token and handle when the host reissues neither', () => {
    const renewed = rehydrated().renewedWith(
      grant({ accessToken: 'xoxb-2', refreshToken: null, handle: null }),
    );

    expect(renewed.accessToken).toBe('xoxb-2');
    expect(renewed.refreshToken).toBe('xoxe-old');
    expect(renewed.handle).toBe('Acme');
  });

  it('renewing is the same link kept alive, not a thing to announce', () => {
    expect(rehydrated().renewedWith(grant()).pullEvents()).toEqual([]);
  });
});
