import type { Branch } from '@work/domain/value-objects/branch.vo';

export type BranchPushRefusal =
  | { readonly kind: 'push-not-to-a-branch'; readonly ref: string }
  | { readonly kind: 'push-deletes-a-branch'; readonly branch: Branch };
