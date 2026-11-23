import { InvalidWorkingCopyStoreError } from '@runners/domain/exceptions/invalid-working-copy-store.error';
import {
  sameWorkingCopyStore,
  WorkingCopyStore,
} from '@runners/domain/value-objects/working-copy-store.vo';
import { describe, expect, it } from 'vitest';

describe('WorkingCopyStore', () => {
  it('keeps the name of a store and of its base snapshot', () => {
    expect(
      WorkingCopyStore.of({
        store: 's3://team-a/working-copies',
        base: 'base-v1',
      }),
    ).toMatchObject({ store: 's3://team-a/working-copies', base: 'base-v1' });
  });

  it('starts working copies without a base when it names none', () => {
    expect(WorkingCopyStore.of({ store: 'zfs:tank/work' }).base).toBeNull();
  });

  it.each(['', '-team', 'team a', 's3://team a', 'a'.repeat(513)])(
    'refuses %j as a store',
    (store) => {
      expect(() => WorkingCopyStore.of({ store })).toThrow(
        InvalidWorkingCopyStoreError,
      );
    },
  );

  it.each(['', '-base', 'base v1', 'a'.repeat(129), 'base/v1'])(
    'refuses %j as a base snapshot',
    (base) => {
      expect(() => WorkingCopyStore.of({ store: 's3://team-a', base })).toThrow(
        /Working copy store base/,
      );
    },
  );

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
