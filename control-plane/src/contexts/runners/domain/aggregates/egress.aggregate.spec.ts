import { anEgress } from '@runners/domain/aggregates/egress.fake-spec';
import { hashOf } from '@runners/domain/aggregates/runner-pool.fake-spec';
import { EgressDefined } from '@runners/domain/events/egress-defined.event';
import { EgressRedefined } from '@runners/domain/events/egress-redefined.event';
import { EgressRetired } from '@runners/domain/events/egress-retired.event';
import { EgressInUseError } from '@runners/domain/exceptions/egress-in-use.error';
import { EgressKeyFixedError } from '@runners/domain/exceptions/egress-key-fixed.error';
import { EgressVersionConflictError } from '@runners/domain/exceptions/egress-version-conflict.error';
import { InvalidEgressError } from '@runners/domain/exceptions/invalid-egress.error';
import { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { describe, expect, it } from 'vitest';

const BY = attributedIn();

const keeping = (url = 'https://egress.example.com') => ({
  key: EgressKey.of('shared'),
  url: EgressUrl.of(url),
});

describe('Egress', () => {
  it('is defined as a change to the workspace’s configuration', () => {
    const [defined] = anEgress().pullEvents();

    expect(defined).toBeInstanceOf(EgressDefined);
    expect((defined as EgressDefined).change.resource).toBe('egress');
    expect((defined as EgressDefined).change.action).toBe('created');
  });

  it('moves to another URL and keeps its token when none is given', () => {
    const egress = anEgress();
    egress.pullEvents();

    const moved = egress.redefinedAs(
      keeping('https://egress-2.example.com'),
      { tokenHash: null, tokenVersion: 1 },
      BY,
    );
    const [event] = moved.pullEvents();

    expect(moved.url.value).toBe('https://egress-2.example.com');
    expect(moved.tokenHash.equals(hashOf('9'))).toBe(true);
    expect(event).toBeInstanceOf(EgressRedefined);
    expect((event as EgressRedefined).change.detail?.recorded()).toEqual({});
  });

  it('rotates its token in place, and records that it did', () => {
    const egress = anEgress();
    egress.pullEvents();

    const rotated = egress.redefinedAs(
      keeping(),
      { tokenHash: hashOf('8'), tokenVersion: 2 },
      BY,
    );
    const [event] = rotated.pullEvents();

    expect(rotated.id.equals(egress.id)).toBe(true);
    expect(rotated.tokenHash.equals(hashOf('8'))).toBe(true);
    expect(rotated.tokenVersion).toBe(2);
    expect((event as EgressRedefined).change.detail?.recorded()).toEqual({
      rekeyed: true,
    });
  });

  it('asks for a token whenever tokenVersion changes', () => {
    expect(() =>
      anEgress().redefinedAs(
        keeping(),
        { tokenHash: null, tokenVersion: 2 },
        BY,
      ),
    ).toThrow(InvalidEgressError);
  });

  it('keeps its key for its life', () => {
    expect(() =>
      anEgress().redefinedAs(
        { ...keeping(), key: EgressKey.of('other') },
        { tokenHash: null, tokenVersion: 1 },
        BY,
      ),
    ).toThrow(EgressKeyFixedError);
  });

  it('is retired only when no runner pool names it', () => {
    const egress = anEgress();
    egress.pullEvents();

    expect(() => egress.retire([PoolKey.of('sandboxes')], BY)).toThrow(
      EgressInUseError,
    );

    const retired = egress.retire([], BY);
    const [event] = retired.pullEvents();

    expect(retired.isRetired).toBe(true);
    expect(event).toBeInstanceOf(EgressRetired);
  });

  it('refuses a write based on another version', () => {
    expect(() => anEgress().assertVersion(1)).toThrow(
      EgressVersionConflictError,
    );
    expect(() => anEgress().assertVersion(0)).not.toThrow();
  });
});

describe('EgressUrl', () => {
  it('takes an absolute http or https URL, and says whether it is secure', () => {
    expect(EgressUrl.of('https://egress.example.com').isSecure).toBe(true);
    expect(EgressUrl.of('http://egress:8443').isSecure).toBe(false);
  });

  it('refuses a URL that is not absolute, has credentials, a query or a fragment', () => {
    for (const raw of [
      'egress.example.com',
      'ftp://egress.example.com',
      'https://user:pass@egress.example.com',
      'https://egress.example.com/?a=1',
      'https://egress.example.com/#a',
    ]) {
      expect(() => EgressUrl.of(raw)).toThrow(InvalidEgressError);
    }
  });
});
