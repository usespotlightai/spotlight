import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';

const MAX_CHARACTERS = 2_000;

const LATEST_SAID = 3;

const clipped = (parts: readonly (string | null | undefined)[]): string =>
  parts
    .filter((each): each is string => Boolean(each?.trim()))
    .join('\n')
    .slice(0, MAX_CHARACTERS);

export const taskWords = (task: Task): string =>
  clipped([
    task.title.value,
    task.description?.value,
    ...task.notes.slice(-LATEST_SAID).map((note) => note.body.value),
  ]);

export const chatWords = (chat: Chat): string =>
  clipped(
    chat.messages
      .filter((message) => message.kind === 'said')
      .slice(-LATEST_SAID)
      .map((message) => message.body.value),
  );
