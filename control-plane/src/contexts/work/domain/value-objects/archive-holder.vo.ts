import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export type ArchiveHolder =
  | { readonly kind: 'task'; readonly taskId: TaskId }
  | { readonly kind: 'chat'; readonly chatId: ChatId };

export type HolderState =
  | {
      readonly kind: 'task';
      readonly finished: boolean;
      readonly changedAt: Date;
    }
  | {
      readonly kind: 'chat';
      readonly conversing: boolean;
      readonly changedAt: Date;
    };
