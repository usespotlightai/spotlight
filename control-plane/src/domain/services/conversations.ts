import type { TaskNoteKind } from '@domain/value-objects/task-note.vo';

export interface Conversation {
  readonly from: number;
  readonly to: number | null;
}

export const stillOpen = (conversation: Conversation): boolean =>
  conversation.to === null;

export const notesIn = <T>(
  conversation: Conversation,
  trail: readonly T[],
): T[] =>
  trail.slice(
    conversation.from,
    conversation.to === null ? undefined : conversation.to + 1,
  );

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

/** Owed while nobody has answered, settled once someone has or it moved on. */
export type ReviewState = 'owed' | 'settled';

export interface Review {
  readonly from: number;
  readonly state: ReviewState;
}

const settledAfter = <T extends { kind: TaskNoteKind }>(
  notes: readonly T[],
  at: number,
): boolean =>
  notes
    .slice(at + 1)
    .some((later) => later.kind === 'answered' || later.kind === 'passed');

export const reviewsIn = <
  T extends { kind: TaskNoteKind; runId: string | null },
>(
  notes: readonly T[],
): Map<string, Review> => {
  const reviews = new Map<string, Review>();

  notes.forEach((note, from) => {
    if (note.kind === 'asked' && note.runId) {
      reviews.set(note.runId, {
        from,
        state: settledAfter(notes, from) ? 'settled' : 'owed',
      });
    }
  });

  return reviews;
};

export const awaitsAPerson = <T extends { kind: TaskNoteKind }>(
  notes: readonly T[],
): boolean => {
  let asked = -1;

  notes.forEach((note, at) => {
    if (note.kind === 'asked') {
      asked = at;
    }
  });

  return asked !== -1 && !settledAfter(notes, asked);
};

/** What it was answering is its briefing, which the run itself keeps. */
export const turnOf = <T extends { runId: string | null }>(
  notes: readonly T[],
  runId: string,
): T[] => {
  const spoke = notes.findIndex((note) => note.runId === runId);
  const ends = spoke === -1 ? notes.length - 1 : spoke;

  if (ends < 0) {
    return [];
  }

  let opens = 0;
  for (let at = ends; at >= 0; at--) {
    if (notes[at]?.runId != null && notes[at]?.runId !== runId) {
      opens = at + 1;
      break;
    }
  }

  return notes.slice(opens, ends + 1);
};
