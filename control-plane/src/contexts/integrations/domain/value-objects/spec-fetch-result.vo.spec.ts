import { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { SpecFetchResult } from '@integrations/domain/value-objects/spec-fetch-result.vo';
import { describe, expect, it } from 'vitest';

const HASH = ContentHash.of('a'.repeat(64));
const EARLIER = new Date('2026-11-06T10:00:00.000Z');
const NOW = new Date('2026-11-07T10:00:00.000Z');

const spec = (fingerprint = 'petstore') =>
  ApiSpec.of({
    kind: 'openapi',
    url: 'https://petstore.example/openapi.json',
    fingerprint,
  });

const read = () =>
  SpecFetchResult.read({ spec: spec(), hash: HASH, readAt: EARLIER });

describe('SpecFetchResult', () => {
  it('spares a new reading of the spec it read without a problem', () => {
    expect(read().spareReadingFor(spec())).toBe(true);
    expect(read().documentKeptFor(spec())?.equals(HASH)).toBe(true);
  });

  it('reads a changed spec again', () => {
    expect(read().spareReadingFor(spec('changed'))).toBe(false);
    expect(read().documentKeptFor(spec('changed'))).toBeNull();
  });

  it('reads again a spec whose last reading had a problem', () => {
    const still = read().stillAfter('it did not answer');

    expect(still.spareReadingFor(spec())).toBe(false);
    expect(still.documentKeptFor(spec())?.equals(HASH)).toBe(true);
  });

  it('keeps the earlier document after a failed reading', () => {
    const unread = SpecFetchResult.unread({
      spec: spec(),
      readAt: NOW,
      problem: 'it did not answer',
      kept: { earlier: read(), skipped: ['GET /pets'] },
    });

    expect(unread.hash?.equals(HASH)).toBe(true);
    expect(unread.problem).toBe('it did not answer');
    expect(unread.skipped).toEqual(['GET /pets']);
  });

  it('fails a reading with no earlier document to keep', () => {
    const unread = SpecFetchResult.unread({
      spec: spec(),
      readAt: NOW,
      problem: 'it did not answer',
      kept: null,
    });

    expect(unread.hash).toBeNull();
    expect(unread.readAt).toEqual(NOW);
  });
});
