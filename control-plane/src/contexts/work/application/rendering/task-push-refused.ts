import { BranchPushRefused } from '@work/application/rendering/branch-push-refused';
import type { TaskPushRefusal } from '@work/domain/value-objects/task-push-refusal';

export const TaskPushRefused = {
  text(refusal: TaskPushRefusal): string {
    switch (refusal.kind) {
      case 'push-not-to-a-branch':
      case 'push-deletes-a-branch':
        return BranchPushRefused.text(refusal);
      case 'push-to-another-branch':
        return `This task pushes only its own branch, ${refusal.taskBranch.value}, not ${refusal.branch.value}. Push the change to ${refusal.taskBranch.value}.`;
      case 'push-rewrites-commits-of-others':
        return `The push replaces commits on ${refusal.branch.value} that Spotlight did not push, or Spotlight could not check it. Fetch the branch, put your commits on top of it with git rebase origin/${refusal.branch.value}, and push again without --force. Push from the checkout of the repository in the workspace: Spotlight checks a push against that checkout, not against another clone.`;
    }
  },
};
