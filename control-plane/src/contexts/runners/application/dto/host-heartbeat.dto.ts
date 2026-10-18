export type HostHeartbeatDto =
  | { readonly outcome: 'accepted'; readonly workspaceId: string }
  | { readonly outcome: 'host-in-use' }
  | { readonly outcome: 'unauthorized' };

export type HostDeregisteredDto =
  | { readonly outcome: 'deregistered' }
  | { readonly outcome: 'unauthorized' };
