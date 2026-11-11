export const ARCHIVE_HOLDERS = Symbol('ARCHIVE_HOLDERS');

export interface HeldWorkingCopy {
  readonly released: boolean;
  readonly changedAt: Date;
}

export interface ArchiveHolderSource {
  readonly owner: string;

  heldOf(
    names: readonly string[],
  ): Promise<ReadonlyMap<string, HeldWorkingCopy>>;
}

export interface ArchiveHoldersPort {
  register(source: ArchiveHolderSource): void;
}
