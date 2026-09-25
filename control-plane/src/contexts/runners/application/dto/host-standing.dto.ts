export type HostStandingDto =
  | { readonly outcome: 'present'; readonly workspaceId: string }
  | { readonly outcome: 'taken' }
  | { readonly outcome: 'refused' };

export type HostLeftDto =
  | { readonly outcome: 'left' }
  | { readonly outcome: 'refused' };
