import { InvalidWorkingCopyStoreError } from '@runners/domain/exceptions/invalid-working-copy-store.error';
import {
  SnapshotName,
  WorkingCopyStoreName,
} from '@shared-kernel/domain/value-objects/working-copy-names.vo';

// Where the hosts of a pull pool or trust keep the working copies of runs: a store that each host's working copy hook
// reaches. Without one, Spotlight keeps them as archives in its own storage. The hook holds whatever credentials the
// store needs; Spotlight keeps only the store's name and the name of its base snapshot.
export class WorkingCopyStore {
  private constructor(
    readonly store: string,
    readonly base: string | null,
  ) {}

  static of(input: { store: string; base?: string | null }): WorkingCopyStore {
    return new WorkingCopyStore(
      WorkingCopyStore.storeOf(input.store),
      input.base === null || input.base === undefined
        ? null
        : WorkingCopyStore.baseOf(input.base),
    );
  }

  static storeOf(raw: string): string {
    if (!WorkingCopyStoreName.isWellFormed(raw)) {
      throw new InvalidWorkingCopyStoreError(
        'store',
        `must name the store the hosts' working copy hook reaches, such as s3://team-a: at most ${WorkingCopyStoreName.MOST} letters, digits and . _ : / @ + -, starting with a letter or digit`,
      );
    }

    return raw;
  }

  static baseOf(raw: string): string {
    if (!SnapshotName.isWellFormed(raw)) {
      throw new InvalidWorkingCopyStoreError(
        'base',
        'must be the name of a snapshot: 1 to 128 letters, digits, dots, dashes or underscores, starting with a letter or digit',
      );
    }

    return raw;
  }

  equals(other: WorkingCopyStore | null): boolean {
    return (
      other !== null && other.store === this.store && other.base === this.base
    );
  }
}

export const sameWorkingCopyStore = (
  one: WorkingCopyStore | null,
  other: WorkingCopyStore | null,
): boolean => (one === null ? other === null : one.equals(other));
