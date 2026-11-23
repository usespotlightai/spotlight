import type { Branch } from '@work/domain/value-objects/branch.vo';

export type TaskPushRefusal =
  | { readonly kind: 'push-not-to-a-branch'; readonly ref: string }
  | { readonly kind: 'push-deletes-a-branch'; readonly branch: Branch }
  | {
      readonly kind: 'push-to-another-branch';
      readonly branch: Branch;
      readonly taskBranch: Branch;
    }
  | {
      readonly kind: 'push-rewrites-commits-of-others';
      readonly branch: Branch;
    };
