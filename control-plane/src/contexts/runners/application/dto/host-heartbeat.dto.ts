export type HostHeartbeatDto =
  | { readonly outcome: 'present'; readonly workspaceId: string }
  | { readonly outcome: 'taken' }
  | { readonly outcome: 'unauthorized' };

export type HostLeftDto =
  | { readonly outcome: 'left' }
  | { readonly outcome: 'unauthorized' };
