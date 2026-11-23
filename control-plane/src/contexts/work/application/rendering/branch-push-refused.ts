import type { BranchPushRefusal } from '@work/domain/value-objects/branch-push-refusal';

export const BranchPushRefused = {
  text(refusal: BranchPushRefusal): string {
    switch (refusal.kind) {
      case 'push-not-to-a-branch':
        return `Spotlight pushes only branches, and ${refusal.ref} is not a branch.`;
      case 'push-deletes-a-branch':
        return `Spotlight does not delete branches. Branch ${refusal.branch.value} stays.`;
    }
  },
};
