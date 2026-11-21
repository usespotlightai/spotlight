// What disabling or enabling the platform pool of a workspace did. Unset: the deployment sets no platform provisioner. Key taken: the workspace has its own pool with the key of the platform pool.
export type PlatformPoolChangeDto =
  | { readonly outcome: 'disabled' }
  | { readonly outcome: 'enabled' }
  | { readonly outcome: 'unset' }
  | { readonly outcome: 'key-taken' };
