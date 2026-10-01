import {
  revertTargetOf,
  sameRevertTarget,
} from '@github/domain/services/revert-convention';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { describe, expect, it } from 'vitest';

const API = Repository.of('acme/api');

describe('revertTargetOf', () => {
  it('names the pull request GitHub’s revert button says it reverts', () => {
    expect(
      revertTargetOf({
        title: 'Revert "Retry failed uploads"',
        body: 'Reverts acme/api#7\n\nIt broke the nightly build.',
        repository: API,
      }),
    ).toEqual({ kind: 'number', number: 7 });
  });

  it('reads the reverted repository regardless of case', () => {
    expect(
      revertTargetOf({
        title: 'Undo',
        body: 'Reverts Acme/API#12',
        repository: API,
      }),
    ).toEqual({ kind: 'number', number: 12 });
  });

  it('falls back to the reverted title where the body names another repository', () => {
    expect(
      revertTargetOf({
        title: 'Revert "Retry failed uploads"',
        body: 'Reverts acme/web#7',
        repository: API,
      }),
    ).toEqual({ kind: 'title', title: 'Retry failed uploads' });
  });

  it('falls back to the reverted title where the body says nothing', () => {
    expect(
      revertTargetOf({
        title: 'Revert "Retry failed uploads"',
        body: null,
        repository: API,
      }),
    ).toEqual({ kind: 'title', title: 'Retry failed uploads' });
  });

  it('takes no ordinary pull request for a revert', () => {
    expect(
      revertTargetOf({
        title: 'Reverting to the old cache was a mistake',
        body: 'This reverts nothing; see acme/api#7',
        repository: API,
      }),
    ).toBeNull();
  });
});

describe('sameRevertTarget', () => {
  it('tells targets apart by what they name', () => {
    expect(
      sameRevertTarget(
        { kind: 'number', number: 7 },
        { kind: 'number', number: 7 },
      ),
    ).toBe(true);
    expect(
      sameRevertTarget(
        { kind: 'number', number: 7 },
        { kind: 'title', title: '7' },
      ),
    ).toBe(false);
    expect(sameRevertTarget(null, null)).toBe(true);
    expect(sameRevertTarget(null, { kind: 'number', number: 7 })).toBe(false);
  });
});
