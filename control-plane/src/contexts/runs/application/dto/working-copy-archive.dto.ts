// The runner uploads to url, or asks its host to make the snapshot in the store of its working copy hook.
export type ArchiveGrantDto =
  | {
      readonly id: string;
      readonly url: string;
      readonly headers: Readonly<Record<string, string>>;
    }
  | {
      readonly id: string;
      readonly snapshot: { readonly name: string };
    };

export type StoredArchiveDto =
  | {
      readonly id: string;
      readonly url: string;
      readonly size: number;
      readonly sha256: string;
    }
  | {
      readonly id: string;
      readonly snapshot: {
        readonly store: string;
        readonly name: string;
        readonly base: string | null;
        readonly rebase: boolean;
      };
    };

export type WorkingCopyArchiveAnswer =
  | { readonly leased: false }
  | { readonly leased: true; readonly archive: StoredArchiveDto | null };

export type SandboxArchiveAnswer =
  | { readonly known: false }
  | { readonly known: true; readonly archive: StoredArchiveDto | null };
