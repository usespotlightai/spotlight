export interface ArchiveGrantDto {
  readonly id: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

interface StoredArchiveDto {
  readonly id: string;
  readonly url: string;
  readonly size: number;
  readonly sha256: string;
}

export type WorkspaceArchiveAnswer =
  | { readonly leased: false }
  | { readonly leased: true; readonly archive: StoredArchiveDto | null };
