import { InvalidWorkingCopyArchiveError } from '@runs/domain/exceptions/invalid-working-copy-archive.error';
import {
  archiveLocationOf,
  type KeptStore,
  SpotlightStorage,
  StoreSnapshot,
} from '@runs/domain/value-objects/archive-location.vo';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import {
  SnapshotName,
  WorkingCopyStoreName,
} from '@shared-kernel/domain/value-objects/working-copy-names.vo';
import { describe, expect, it } from 'vitest';

const SHA256 = 'a'.repeat(64);

const kept = (base: string | null, store = 's3://team-a'): KeptStore => ({
  store: WorkingCopyStoreName.of(store),
  base: base === null ? null : SnapshotName.of(base),
});

const snapshotIn = (store: string, base: string | null) =>
  StoreSnapshot.of(
    WorkingCopyStoreName.of(store),
    base === null ? null : SnapshotName.of(base),
  );

describe('where an archive is kept', () => {
  it('keeps the tar of a runner whose pool keeps no store in Spotlight’s storage', () => {
    const location = archiveLocationOf(
      { kind: 'tar', size: 1_024, sha256: SHA256 },
      null,
      null,
    );

    expect(location).toBeInstanceOf(SpotlightStorage);
  });

  it('keeps the snapshot of a runner whose pool keeps a store in that store, as Spotlight knows it', () => {
    const location = archiveLocationOf(
      { kind: 'snapshot', base: 'base-v1' },
      kept('base-v1'),
      null,
    );

    expect(location).toBeInstanceOf(StoreSnapshot);
    expect(location.kind === 'snapshot' && location.store.value).toBe(
      's3://team-a',
    );
  });

  it('refuses a tar from a runner whose pool keeps a store, and a snapshot from one whose pool keeps none', () => {
    expect(() =>
      archiveLocationOf(
        { kind: 'tar', size: 1_024, sha256: SHA256 },
        kept('base-v1'),
        null,
      ),
    ).toThrow(/is a snapshot its host makes, not a tar/);
    expect(() =>
      archiveLocationOf({ kind: 'snapshot', base: null }, null, null),
    ).toThrow(/is a tar it uploads, not a snapshot/);
  });

  it('takes as the base of a snapshot the store’s base, or the base of the working copy the run restored', () => {
    const restored = snapshotIn('s3://team-a', 'base-v1');

    expect(
      archiveLocationOf(
        { kind: 'snapshot', base: 'base-v2' },
        kept('base-v2'),
        restored,
      ),
    ).toMatchObject({ base: SnapshotName.of('base-v2') });
    expect(
      archiveLocationOf(
        { kind: 'snapshot', base: 'base-v1' },
        kept('base-v2'),
        restored,
      ),
    ).toMatchObject({ base: SnapshotName.of('base-v1') });
  });

  it('refuses any other base, also that of a working copy of another store', () => {
    expect(() =>
      archiveLocationOf(
        { kind: 'snapshot', base: 'base-v9' },
        kept('base-v2'),
        null,
      ),
    ).toThrow(InvalidWorkingCopyArchiveError);
    expect(() =>
      archiveLocationOf(
        { kind: 'snapshot', base: 'base-v1' },
        kept('base-v2'),
        snapshotIn('s3://team-b', 'base-v1'),
      ),
    ).toThrow(/neither the base of store s3:\/\/team-a/);
  });

  it('refuses a tar with no size or no SHA-256', () => {
    expect(() =>
      archiveLocationOf({ kind: 'tar', size: 0, sha256: SHA256 }, null, null),
    ).toThrow(InvalidWorkingCopyArchiveError);
  });

  it('names the snapshot of an archive after the archive', () => {
    expect(
      StoreSnapshot.nameOf(WorkingCopyArchiveId.of('archive_1')).value,
    ).toBe('spotlight-archive_1');
  });
});
