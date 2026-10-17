import { anEgress } from '@runners/domain/aggregates/egress.fake-spec';
import { hashOf } from '@runners/domain/aggregates/runner-pool.fake-spec';
import { EgressCreated } from '@runners/domain/events/egress-created.event';
import { EgressDeleted } from '@runners/domain/events/egress-deleted.event';
import { EgressUpdated } from '@runners/domain/events/egress-updated.event';
import { EgressInUseError } from '@runners/domain/exceptions/egress-in-use.error';
import { EgressVersionConflictError } from '@runners/domain/exceptions/egress-version-conflict.error';
import { InvalidEgressError } from '@runners/domain/exceptions/invalid-egress.error';
import { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { describe, expect, it } from 'vitest';

const BY = attributedIn();

const keeping = (url = 'https://egress.example.com') => ({
  key: EgressKey.of('shared'),
  url: EgressUrl.of(url),
});

describe('Egress', () => {
  it('is created as a change to the workspace’s configuration', () => {
    const [created] = anEgress().pullEvents();

    expect(created).toBeInstanceOf(EgressCreated);
    expect((created as EgressCreated).change.resource).toBe('egress');
    expect((created as EgressCreated).change.action).toBe('created');
  });

  it('moves to another URL and keeps its token when none is given', () => {
    const egress = anEgress();
    egress.pullEvents();

    const moved = egress.update(
      keeping('https://egress-2.example.com'),
      { tokenHash: null, tokenVersion: 1 },
      BY,
    );
    const [event] = moved.pullEvents();

    expect(moved.url.value).toBe('https://egress-2.example.com');
    expect(moved.tokenHash.equals(hashOf('9'))).toBe(true);
    expect(event).toBeInstanceOf(EgressUpdated);
    expect((event as EgressUpdated).change.detail?.recorded()).toEqual({});
  });

  it('rotates its token in place, and records that it did', () => {
    const egress = anEgress();
    egress.pullEvents();

    const rotated = egress.update(
      keeping(),
      { tokenHash: hashOf('8'), tokenVersion: 2 },
      BY,
    );
    const [event] = rotated.pullEvents();

    expect(rotated.id.equals(egress.id)).toBe(true);
    expect(rotated.tokenHash.equals(hashOf('8'))).toBe(true);
    expect(rotated.tokenVersion).toBe(2);
    expect((event as EgressUpdated).change.detail?.recorded()).toEqual({
      rekeyed: true,
    });
  });

  it('asks for a token whenever tokenVersion changes', () => {
    expect(() =>
      anEgress().update(keeping(), { tokenHash: null, tokenVersion: 2 }, BY),
    ).toThrow(InvalidEgressError);
  });

  it('keeps its key for its life', () => {
    expect(() =>
      anEgress().update(
        { ...keeping(), key: EgressKey.of('other') },
        { tokenHash: null, tokenVersion: 1 },
        BY,
      ),
    ).toThrow(ImmutableFieldError);
  });

  it('is deleted only when no runner pool names it', () => {
    const egress = anEgress();
    egress.pullEvents();

    expect(() => egress.delete([PoolKey.of('sandboxes')], BY)).toThrow(
      EgressInUseError,
    );

    const deleted = egress.delete([], BY);
    const [event] = deleted.pullEvents();

    expect(deleted.isDeleted).toBe(true);
    expect(event).toBeInstanceOf(EgressDeleted);
  });

  it('rejects a write based on another version', () => {
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

  it('rejects a URL that is not absolute, has credentials, a query or a fragment', () => {
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
