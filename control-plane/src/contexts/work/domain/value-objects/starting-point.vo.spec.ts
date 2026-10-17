import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidStartingPointError } from '@work/domain/exceptions/invalid-starting-point.error';
import { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import { StartingPoint } from '@work/domain/value-objects/starting-point.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-01T09:00:00.000Z');
const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';

const checkout = (path: string, commit = COMMIT) =>
  StartedCheckout.of({ path, commit });

describe('StartedCheckout', () => {
  it('names the commit a checkout began at by its full SHA', () => {
    expect(checkout(' api ').parts).toEqual({ path: 'api', commit: COMMIT });
  });

  it('rejects a short, upper-case or missing commit', () => {
    for (const commit of [COMMIT.slice(0, 12), COMMIT.toUpperCase(), '']) {
      expect(() => checkout('api', commit)).toThrow(InvalidStartingPointError);
    }
  });

  it('rejects a checkout with no path', () => {
    expect(() => checkout('  ')).toThrow(InvalidStartingPointError);
  });
});

describe('StartingPoint', () => {
  const point = (...checkouts: StartedCheckout[]) =>
    StartingPoint.of({
      archive: WorkspaceArchiveId.of('archive_1'),
      checkouts,
      attempt: 1,
      at: AT,
    });

  it('keeps its checkouts in path order, whatever order they were told in', () => {
    expect(point(checkout('web'), checkout('api')).paths).toEqual([
      'api',
      'web',
    ]);
  });

  it('rejects the same checkout named twice', () => {
    expect(() => point(checkout('api'), checkout('api'))).toThrow(
      InvalidStartingPointError,
    );
  });

  it('is the same start when the same archive and commits are told again, in any order', () => {
    const recorded = point(checkout('api'), checkout('web'));

    expect(
      recorded.sameAs({
        archive: WorkspaceArchiveId.of('archive_1'),
        checkouts: [checkout('web'), checkout('api')],
      }),
    ).toBe(true);
    expect(
      recorded.sameAs({
        archive: null,
        checkouts: [checkout('web'), checkout('api')],
      }),
    ).toBe(false);
  });

  it('reads back as it was stored', () => {
    const recorded = point(checkout('api'));

    expect(StartingPoint.rehydrate(recorded.parts).equals(recorded)).toBe(true);
  });

  it('takes a stored start that no longer reads for a fault in what was stored, not in what was told', () => {
    const recorded = point(checkout('api')).parts;

    for (const corrupt of [
      { ...recorded, checkouts: [{ path: 'api', commit: 'abc' }] },
      {
        ...recorded,
        checkouts: [...recorded.checkouts, ...recorded.checkouts],
      },
    ]) {
      expect(() => StartingPoint.rehydrate(corrupt)).toThrow(
        InconsistentStateError,
      );
    }
  });
});
