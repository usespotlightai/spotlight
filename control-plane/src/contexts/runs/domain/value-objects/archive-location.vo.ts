import { InvalidWorkingCopyArchiveError } from '@runs/domain/exceptions/invalid-working-copy-archive.error';
import type { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import type { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import {
  SnapshotName,
  WorkingCopyStoreName,
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
    readonly store: string,
    readonly base: string | null,
  ) {}

  static of(store: string, base: string | null = null): StoreSnapshot {
    if (!WorkingCopyStoreName.isWellFormed(store)) {
      throw new InvalidWorkingCopyArchiveError(
        `store must name the store of the hosts' working copy hook, such as s3://team-a, in at most ${WorkingCopyStoreName.MOST} characters`,
      );
    }

    if (base !== null && !SnapshotName.isWellFormed(base)) {
      throw new InvalidWorkingCopyArchiveError(
        'base must be the name of a snapshot: 1 to 128 letters, digits, dots, dashes or underscores',
      );
    }

    return new StoreSnapshot(store, base);
  }

  // The archive id names the snapshot, so the archive and the snapshot are one.
  static nameOf(id: WorkingCopyArchiveId): string {
    return `${SNAPSHOT_PREFIX}${id.value}`;
  }

  // A later base of the store replaces this one when the working copy descends from another base.
  descendsFrom(base: string | null): boolean {
    return this.base === base;
  }
}

export type ArchiveLocation = SpotlightStorage | StoreSnapshot;
