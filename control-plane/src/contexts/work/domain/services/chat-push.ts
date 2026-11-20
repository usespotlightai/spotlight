import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Branch } from '@work/domain/value-objects/branch.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { ChatRefusal } from '@work/domain/value-objects/chat-refusal';
import type { RefUpdate } from '@work/domain/value-objects/ref-update.vo';

export const ChatPush = {
  refusal(input: {
    chat: ChatId;
    update: RefUpdate;
    defaultBranch: Branch;
    owner: Task | null;
  }): ChatRefusal | null {
    const { chat, update, defaultBranch, owner } = input;
    const branch = update.branch;

    if (!branch) {
      return { kind: 'push-not-to-a-branch', ref: update.ref };
    }

    if (branch.equals(defaultBranch)) {
      return { kind: 'push-to-default-branch', branch };
    }

    if (update.deletes) {
      return { kind: 'push-deletes-a-branch', branch };
    }

    if (!owner || owner.heldFor(chat)) {
      return null;
    }

    return owner.wasHeldFor(chat)
      ? { kind: 'branch-of-released-task', branch, completed: owner.finished }
      : { kind: 'branch-of-another-task', branch };
  },
};
