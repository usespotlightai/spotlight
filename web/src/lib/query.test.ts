import { describe, expect, it } from 'vitest';
import { failed, loading } from '@/lib/query';

describe('loading', () => {
  it('is true while nothing has come back yet', () => {
    expect(
      loading({ data: undefined, isPending: true, errorUpdateCount: 0 }),
    ).toBe(true);
  });

  it('stops once a failure is known, even while it tries again', () => {
    expect(
      loading({ data: undefined, isPending: true, errorUpdateCount: 1 }),
    ).toBe(false);
  });
});

describe('failed', () => {
  it('is true when there is nothing to show and it has failed', () => {
    expect(
      failed({ data: undefined, isPending: false, errorUpdateCount: 1 }),
    ).toBe(true);
  });

  it('is true while it tries again after failing', () => {
    expect(
      failed({ data: undefined, isPending: true, errorUpdateCount: 1 }),
    ).toBe(true);
  });

  it('keeps what it had when a later refresh fails', () => {
    expect(failed({ data: [], isPending: false, errorUpdateCount: 2 })).toBe(
      false,
    );
  });
});
