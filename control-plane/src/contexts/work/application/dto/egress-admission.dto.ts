export type EgressAdmissionDto =
  | { readonly outcome: 'refused' }
  | {
      readonly outcome: 'admitted';
      readonly runnerId: string;
      readonly workspaceId: string;
      readonly controlPlaneHost: string;
      readonly controlPlanePort: number;
      readonly reaches: readonly string[];
    };

export type EgressActiveRunsDto =
  | { readonly outcome: 'refused' }
  | { readonly outcome: 'too-many'; readonly max: number }
  | { readonly outcome: 'checked'; readonly active: readonly string[] };
