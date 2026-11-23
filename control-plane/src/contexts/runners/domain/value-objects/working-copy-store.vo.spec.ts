import {
  sameWorkingCopyStore,
  WorkingCopyStore,
} from '@runners/domain/value-objects/working-copy-store.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('WorkingCopyStore', () => {
  it('keeps the name of a store and of its base snapshot', () => {
    const store = WorkingCopyStore.of({
      store: 's3://team-a/working-copies',
      base: 'base-v1',
    });

    expect(store.store.value).toBe('s3://team-a/working-copies');
    expect(store.base?.value).toBe('base-v1');
  });

  it('starts working copies without a base when it names none', () => {
    expect(WorkingCopyStore.of({ store: 'zfs:tank/work' }).base).toBeNull();
  });

  it('refuses a store or a base that is not a name', () => {
    expect(() => WorkingCopyStore.of({ store: 'team a' })).toThrow(
      InvalidIdentifierError,
    );
    expect(() =>
      WorkingCopyStore.of({ store: 's3://team-a', base: 'base/v1' }),
    ).toThrow(InvalidIdentifierError);
  });

  it('is the same store only with the same name and base', () => {
    const store = WorkingCopyStore.of({ store: 's3://team-a', base: 'b' });

    expect(
      sameWorkingCopyStore(
        store,
        WorkingCopyStore.of({ store: 's3://team-a', base: 'b' }),
      ),
    ).toBe(true);
    expect(
      sameWorkingCopyStore(
        store,
        WorkingCopyStore.of({ store: 's3://team-a' }),
      ),
    ).toBe(false);
    expect(sameWorkingCopyStore(store, null)).toBe(false);
    expect(sameWorkingCopyStore(null, null)).toBe(true);
  });
});
