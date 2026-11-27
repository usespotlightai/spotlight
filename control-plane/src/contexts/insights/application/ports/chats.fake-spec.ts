import type {
  ChatsPort,
  StartedChat,
} from '@insights/application/ports/chats.port';
import { ownedIn } from '@insights/scoped.fake-spec';

export const chatsInMemory = (): ChatsPort & {
  readonly stored: Map<string, StartedChat>;
} => {
  const stored = new Map<string, StartedChat>();

  return {
    stored,
    note: (chat) => {
      if (!stored.has(chat.chatId)) {
        stored.set(chat.chatId, chat);
      }

      return Promise.resolve();
    },
    removeIn: (scope) => {
      for (const [id, each] of stored) {
        if (ownedIn(scope, each)) {
          stored.delete(id);
        }
      }

      return Promise.resolve();
    },
  };
};
