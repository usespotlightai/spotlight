import type { ChatRefusal } from '@work/domain/value-objects/chat-refusal';

export const ChatRefused = {
  text(refusal: ChatRefusal): string {
    switch (refusal.kind) {
      case 'approval-needs-a-task':
        return `${refusal.tool.value} has to be approved by a person on a task, and a chat has nobody to put it to.`;
      case 'connection-needs-a-task':
        return `${refusal.providedBy} acts as each person who starts a task, and a chat has no task to ask anyone to connect it on`;
      case 'push-not-to-a-branch':
        return `A chat pushes only branches, and ${refusal.ref} is not a branch.`;
      case 'push-deletes-a-branch':
        return `A chat does not delete branches. Branch ${refusal.branch.value} stays.`;
      case 'push-to-default-branch':
        return `${refusal.branch.value} is the default branch. Push the change to a new branch and open a pull request.`;
      case 'branch-of-another-task':
        return `Branch ${refusal.branch.value} belongs to another task. Push the change to a new branch.`;
      case 'base-differs-from-task':
        return `The task of branch ${refusal.branch.value} starts from ${refusal.base ? `branch ${refusal.base.value}` : 'the default branch'}, and its pull request goes there. Open the pull request without a base, or push the change to a new branch.`;
      case 'branch-of-released-task':
        return `The task of branch ${refusal.branch.value} ${refusal.completed ? 'is completed' : 'was handed to the line'}. Push the change to a new branch.`;
      case 'branch-off-the-line':
        return `The task of branch ${refusal.branch.value} is on ${refusal.line.value}, which does not work on ${refusal.repository.value}. Push the change in ${refusal.repository.value} to a branch with another name.`;
    }
  },
};
