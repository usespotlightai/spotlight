import {
  SnapshotName,
  WorkingCopyStoreName,
} from '@shared-kernel/domain/value-objects/working-copy-names.vo';

// Where the hosts of a pull pool or trust keep the working copies of runs: a store that each host's working copy hook
// reaches. Without one, Spotlight keeps them as archives in its own storage. The hook holds whatever credentials the
// store needs; Spotlight keeps only the store's name and the name of its base snapshot.
export class WorkingCopyStore {
  private constructor(
    readonly store: WorkingCopyStoreName,
    readonly base: SnapshotName | null,
  ) {}

  static of(input: { store: string; base?: string | null }): WorkingCopyStore {
    return new WorkingCopyStore(
      WorkingCopyStoreName.of(input.store),
      input.base === null || input.base === undefined
        ? null
        : SnapshotName.of(input.base),
    );
  }

  equals(other: WorkingCopyStore | null): boolean {
    return (
      other !== null &&
      other.store.equals(this.store) &&
      SnapshotName.same(other.base, this.base)
    );
  }
}

export const sameWorkingCopyStore = (
  one: WorkingCopyStore | null,
  other: WorkingCopyStore | null,
): boolean => (one === null ? other === null : one.equals(other));
