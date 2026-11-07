export const ARCHIVE_HOLDERS = Symbol('ARCHIVE_HOLDERS');

export interface HeldWorkspace {
  readonly released: boolean;
  readonly changedAt: Date;
}

export interface ArchiveHolderSource {
  readonly owner: string;

  heldOf(names: readonly string[]): Promise<ReadonlyMap<string, HeldWorkspace>>;
}

export interface ArchiveHoldersPort {
  register(source: ArchiveHolderSource): void;
}
