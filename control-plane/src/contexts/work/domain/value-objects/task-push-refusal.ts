import type { BranchPushRefusal } from '@work/domain/value-objects/branch-push-refusal';
import type { Branch } from '@work/domain/value-objects/branch.vo';

export type TaskPushRefusal =
  | BranchPushRefusal
  | {
      readonly kind: 'push-to-another-branch';
      readonly branch: Branch;
      readonly taskBranch: Branch;
    }
  | {
      readonly kind: 'push-rewrites-commits-of-others';
      readonly branch: Branch;
    };
