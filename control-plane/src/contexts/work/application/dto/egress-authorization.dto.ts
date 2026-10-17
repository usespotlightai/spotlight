export type EgressAuthorizationDto =
  | { readonly outcome: 'unauthorized' }
  | {
      readonly outcome: 'authorized';
      readonly runnerId: string;
      readonly workspaceId: string;
      readonly controlPlaneHost: string;
      readonly controlPlanePort: number;
      readonly extraAllowedHosts: readonly string[];
    };

export type EgressActiveRunsDto =
  | { readonly outcome: 'unauthorized' }
  | { readonly outcome: 'too-many'; readonly max: number }
  | { readonly outcome: 'checked'; readonly active: readonly string[] };
