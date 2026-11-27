import type {
  ChatRunSpend,
  ChatsPort,
  StartedChat,
} from '@insights/application/ports/chats.port';
import { ownedIn } from '@insights/scoped.fake-spec';

export const chatsInMemory = (): ChatsPort & {
  readonly stored: Map<string, StartedChat>;
  readonly spending: Map<string, ChatRunSpend>;
} => {
  const stored = new Map<string, StartedChat>();
  const spending = new Map<string, ChatRunSpend>();

  return {
    stored,
    spending,
    note: async (chat) => {
      if (!stored.has(chat.chatId)) {
        stored.set(chat.chatId, chat);
      }
    },
    spent: async (run) => {
      if (!spending.has(run.runId.value)) {
        spending.set(run.runId.value, run);
      }
    },
    removeIn: async (scope) => {
      for (const [id, each] of stored) {
        if (ownedIn(scope, each)) {
          stored.delete(id);
        }
      }
      for (const [id, each] of spending) {
        if (ownedIn(scope, each)) {
          spending.delete(id);
        }
      }
    },
  };
};
