import type { ChatRefusal } from '@work/domain/value-objects/chat-refusal.vo';

export const ChatRefused = {
  text(refusal: ChatRefusal): string {
    switch (refusal.kind) {
      case 'approval-needs-a-task':
        return `${refusal.tool.value} has to be approved by a person on a task, and a chat has nobody to put it to.`;
      case 'connection-needs-a-task':
        return `${refusal.providedBy} acts as each person who starts a task, and a chat has no task to ask anyone to connect it on`;
    }
  },
};
