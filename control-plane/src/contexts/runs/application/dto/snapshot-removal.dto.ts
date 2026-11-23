export interface SnapshotRemovalDto {
  readonly archiveId: string;
  readonly snapshot: string;
}

export type SnapshotRemovalsDto =
  | { readonly outcome: 'unauthorized' }
  | {
      readonly outcome: 'listed';
      readonly store: string | null;
      readonly removals: readonly SnapshotRemovalDto[];
    };

export type ForgottenSnapshotRemovalDto =
  | { readonly outcome: 'unauthorized' }
  | { readonly outcome: 'forgotten' | 'unknown' };
