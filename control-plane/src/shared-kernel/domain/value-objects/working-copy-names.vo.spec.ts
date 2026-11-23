import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  SnapshotName,
  WorkingCopyStoreName,
} from '@shared-kernel/domain/value-objects/working-copy-names.vo';
import { describe, expect, it } from 'vitest';

describe('WorkingCopyStoreName', () => {
  it.each(['s3://team-a/working-copies', 'zfs:tank/work', 'team+a@host'])(
    'names the store %s',
    (store) => {
      expect(WorkingCopyStoreName.of(store).value).toBe(store);
    },
  );

  it.each(['', '-team', 'team a', 's3://team a', 'a'.repeat(513)])(
    'refuses %j',
    (store) => {
      expect(() => WorkingCopyStoreName.of(store)).toThrow(
        InvalidIdentifierError,
      );
    },
  );

  it('is the same store only by the same name', () => {
    expect(
      WorkingCopyStoreName.of('s3://a').equals(
        WorkingCopyStoreName.of('s3://a'),
      ),
    ).toBe(true);
    expect(
      WorkingCopyStoreName.of('s3://a').equals(
        WorkingCopyStoreName.of('s3://b'),
      ),
    ).toBe(false);
    expect(WorkingCopyStoreName.of('s3://a').equals(null)).toBe(false);
  });
});

describe('SnapshotName', () => {
  it('names a snapshot', () => {
    expect(SnapshotName.of('base-v1.2_x').value).toBe('base-v1.2_x');
  });

  it.each(['', '-base', 'base v1', 'base/v1', 'a'.repeat(129)])(
    'refuses %j',
    (name) => {
      expect(() => SnapshotName.of(name)).toThrow(InvalidIdentifierError);
    },
  );

  it('compares names that may be absent', () => {
    expect(SnapshotName.same(null, null)).toBe(true);
    expect(SnapshotName.same(SnapshotName.of('a'), null)).toBe(false);
    expect(SnapshotName.same(SnapshotName.of('a'), SnapshotName.of('a'))).toBe(
      true,
    );
  });
});
