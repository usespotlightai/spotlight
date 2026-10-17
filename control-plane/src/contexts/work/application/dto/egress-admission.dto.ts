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

export type EgressHoldsDto =
  | { readonly outcome: 'refused' }
  | { readonly outcome: 'too-many'; readonly most: number }
  | { readonly outcome: 'kept'; readonly held: readonly string[] };
