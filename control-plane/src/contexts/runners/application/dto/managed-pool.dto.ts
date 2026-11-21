// What turning a workspace's managed pool off or on did. Off: the deployment sets no managed provisioner. Owned: the workspace has its own pool with the managed key.
export type ManagedPoolChangeDto =
  | { readonly outcome: 'updated'; readonly disabled: boolean }
  | { readonly outcome: 'off' }
  | { readonly outcome: 'owned' };
