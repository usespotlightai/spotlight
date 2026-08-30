import type { TaskNoteKind } from '@domain/value-objects/task-note.vo';

/** Where one begins and ends in a task's trail, by position. */
export interface Conversation {
  readonly from: number;
  // Where it was closed, or absent while it is still theirs.
  readonly to: number | null;
}

/** Still theirs: nothing has closed it, so it is what they are owed. */
export const stillOpen = (conversation: Conversation): boolean =>
  conversation.to === null;

/** What a conversation covers: the note that opened it, through the one that closed it. */
export const notesIn = <T>(
  conversation: Conversation,
  trail: readonly T[],
): T[] =>
  trail.slice(
    conversation.from,
    conversation.to === null ? undefined : conversation.to + 1,
  );

/**
 * An 'asked' opens one and a 'passed' closes it. Asking again inside an open
 * one is the same conversation carrying on, not a second thing owed.
 */
export const conversationsOf = (
  kinds: readonly TaskNoteKind[],
): Conversation[] => {
  const cut: Conversation[] = [];
  let open: number | null = null;

  kinds.forEach((kind, at) => {
    if (kind === 'asked' && open === null) {
      open = at;
      return;
    }

    if (kind === 'passed' && open !== null) {
      cut.push({ from: open, to: at });
      open = null;
    }
  });

  if (open !== null) {
    cut.push({ from: open, to: null });
  }

  return cut;
};
