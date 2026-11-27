import { InvalidWorkingCopyArchiveError } from '@runs/domain/exceptions/invalid-working-copy-archive.error';
import { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import {
  SnapshotName,
  type WorkingCopyStoreName,
} from '@shared-kernel/domain/value-objects/working-copy-names.vo';

const SNAPSHOT_PREFIX = 'spotlight-';

// A tar of the workspace in Spotlight's object storage, uploaded by the runner.
export class SpotlightStorage {
  readonly kind = 'spotlight' as const;

  private constructor(
    readonly size: ArchiveSize,
    readonly digest: ArchiveDigest,
  ) {}

  static of(size: ArchiveSize, digest: ArchiveDigest): SpotlightStorage {
    return new SpotlightStorage(size, digest);
  }
}

// A snapshot in the store of the hosts' working copy hook. Only a host that reaches the store can restore or remove it.
// base is the base snapshot its working copy descends from, or null for a working copy that started without one.
export class StoreSnapshot {
  readonly kind = 'snapshot' as const;

  private constructor(
    readonly store: WorkingCopyStoreName,
    readonly base: SnapshotName | null,
  ) {}

  static of(
    store: WorkingCopyStoreName,
    base: SnapshotName | null = null,
  ): StoreSnapshot {
    return new StoreSnapshot(store, base);
  }

  // The archive id names the snapshot, so the archive and the snapshot are one.
  static nameOf(id: WorkingCopyArchiveId): SnapshotName {
    return SnapshotName.of(`${SNAPSHOT_PREFIX}${id.value}`);
  }

  isIn(store: WorkingCopyStoreName): boolean {
    return this.store.equals(store);
  }

  // A later base of the store replaces this one when the working copy descends from another base.
  descendsFrom(base: SnapshotName | null): boolean {
    return SnapshotName.same(this.base, base);
  }
}

export type ArchiveLocation = SpotlightStorage | StoreSnapshot;

// The store the pool or trust of a runner keeps working copies in, as Spotlight knows it.
export interface KeptStore {
  readonly store: WorkingCopyStoreName;
  readonly base: SnapshotName | null;
}

// What a runner asks to archive: a tar it uploads, or a snapshot its host makes, which descends from base.
export type RequestedArchive =
  | { readonly kind: 'tar'; readonly size: number; readonly sha256: string }
  | { readonly kind: 'snapshot'; readonly base: string | null };

const baseOf = (raw: string | null): SnapshotName | null =>
  raw === null ? null : SnapshotName.of(raw);

// Where an archive is kept follows from the runner's pool or trust, never from what the runner names. A runner whose
// pool keeps a store makes snapshots in it; another uploads tars. The base of a snapshot is the store's current base,
// or the base of the working copy the run restored: nothing else.
export const archiveLocationOf = (
  requested: RequestedArchive,
  kept: KeptStore | null,
  restoring: ArchiveLocation | null,
): ArchiveLocation => {
  if (requested.kind === 'tar') {
    if (kept) {
      throw new InvalidWorkingCopyArchiveError(
        `of a runner whose pool or trust keeps working copies in store ${kept.store.value} is a snapshot its host makes, not a tar`,
      );
    }

    return SpotlightStorage.of(
      ArchiveSize.of(requested.size),
      ArchiveDigest.of(requested.sha256),
    );
  }

  if (!kept) {
    throw new InvalidWorkingCopyArchiveError(
      'of a runner whose pool or trust keeps no working copy store is a tar it uploads, not a snapshot',
    );
  }

  const base = baseOf(requested.base);
  const restored =
    restoring?.kind === 'snapshot' && restoring.isIn(kept.store)
      ? restoring
      : null;

  if (
    !SnapshotName.same(base, kept.base) &&
    restored?.descendsFrom(base) !== true
  ) {
    throw new InvalidWorkingCopyArchiveError(
      `descends from ${base ? `base ${base.value}` : 'no base'}, which is neither the base of store ${kept.store.value} nor the base of the working copy the run restored`,
    );
  }

  return StoreSnapshot.of(kept.store, base);
};
