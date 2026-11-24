// What a change to the platform pool of a workspace did. Unset: the deployment sets no platform provisioner. Key taken: the workspace has its own pool with the key of the platform pool.
// Enabled or disabled: the pool after the change, with the work that the operator allows it for the workspace.
export type PlatformPoolChangeDto =
  | {
      readonly outcome: 'disabled' | 'enabled';
      readonly allowsSecrets: boolean;
      readonly allowsReviewWork: boolean;
    }
  | { readonly outcome: 'unset' }
  | { readonly outcome: 'key-taken' };
