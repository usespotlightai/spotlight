export interface ArchiveGrantDto {
  readonly id: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

interface HeldArchiveDto {
  readonly id: string;
  readonly url: string;
  readonly size: number;
  readonly sha256: string;
}

export type WorkspaceArchiveAnswer =
  | { readonly held: false }
  | { readonly held: true; readonly archive: HeldArchiveDto | null };
