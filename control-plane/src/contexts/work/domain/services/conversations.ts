import type { TaskNoteKind } from '@work/domain/entities/task-note.entity';

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
      return;
    }

    if (kind === 'reopened' && open === null) {
      open = cut.pop()?.from ?? null;
    }
  });

  if (open !== null) {
    cut.push({ from: open, to: null });
  }

  return cut;
};

export type ReviewState = 'pending' | 'answered';

export interface Review {
  readonly from: number;
  readonly state: ReviewState;
}

const sinceReopened = <T extends { kind: TaskNoteKind }>(
  notes: readonly T[],
): readonly T[] => {
  const reopened = notes.map((each) => each.kind).lastIndexOf('reopened');

  return notes.slice(reopened + 1);
};

const answeredAfter = <T extends { kind: TaskNoteKind }>(
  notes: readonly T[],
  at: number,
): boolean =>
  sinceReopened(notes.slice(at + 1)).some(
    (later) => later.kind === 'answered' || later.kind === 'passed',
  );

const containing = (cut: readonly Conversation[], at: number) =>
  cut.find((each) => each.from <= at && (each.to === null || at <= each.to));

export const reviewsIn = <
  T extends { kind: TaskNoteKind; runId: string | null },
>(
  notes: readonly T[],
): Map<string, Review> => {
  const reviews = new Map<string, Review>();
  const cut = conversationsOf(notes.map((each) => each.kind));

  notes.forEach((note, at) => {
    if (note.kind !== 'asked' || !note.runId) {
      return;
    }

    const conversation = containing(cut, at);

    if (conversation) {
      reviews.set(note.runId, {
        from: conversation.from,
        state: answeredAfter(notes, at) ? 'answered' : 'pending',
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

  return asked !== -1 && !answeredAfter(notes, asked);
};

export const pendingIn = <T extends { kind: TaskNoteKind }>(
  notes: readonly T[],
): Conversation | null => {
  if (!awaitsAPerson(notes)) {
    return null;
  }

  const cut = conversationsOf(notes.map((each) => each.kind));
  const last = cut[cut.length - 1];

  return last && stillOpen(last) ? last : null;
};

export const worksOn = <T extends { kind: TaskNoteKind }>(
  running: boolean,
  notes: readonly T[],
): boolean => running && !awaitsAPerson(notes);
