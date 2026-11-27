import { itemAt } from '@shared-kernel/domain/item-at';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  TaskNoteForm,
  TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
import { anyUnread, type ReadableNote } from '@work/domain/services/unread';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';

const OPENS_A_CONVERSATION = 'asked' satisfies TaskNoteKind;

export const CLOSES_A_CONVERSATION = 'passed' satisfies TaskNoteKind;

const REOPENS_A_CONVERSATION = 'reopened' satisfies TaskNoteKind;

export const ANSWERS_A_QUESTION = 'answered' satisfies TaskNoteKind;

export const TURNING_NOTE_KINDS: readonly TaskNoteKind[] = [
  OPENS_A_CONVERSATION,
  ANSWERS_A_QUESTION,
  CLOSES_A_CONVERSATION,
  REOPENS_A_CONVERSATION,
];

export interface Conversation {
  readonly from: NotePosition;
  readonly to: NotePosition | null;
}

export interface ClosingNote {
  readonly form: TaskNoteForm;
  readonly byAPerson: boolean;
}

export const stillOpen = <T>(conversation: {
  readonly from: T;
  readonly to: T | null;
}): boolean => conversation.to === null;

export const openIn = <
  T extends { readonly from: unknown; readonly to: unknown },
>(
  cut: readonly T[],
): T | null => {
  const last = itemAt(cut, cut.length - 1);

  return last !== undefined && stillOpen(last) ? last : null;
};

export const unreadIn = (
  conversation: { readonly notes: readonly ReadableNote[] },
  taskFinished: boolean,
): boolean => !taskFinished && anyUnread(conversation.notes);

export const reopenable = (
  from: NotePosition,
  last: Conversation | null,
  closing: ClosingNote | null,
): boolean =>
  last !== null &&
  !stillOpen(last) &&
  last.from.equals(from) &&
  closing?.form === 'resolved' &&
  closing.byAPerson;

export const lastAskIn = <T extends { readonly kind: TaskNoteKind }>(
  notes: readonly T[],
): T | null =>
  [...notes].reverse().find((each) => each.kind === OPENS_A_CONVERSATION) ??
  null;

export const openAskIn = <T extends { readonly kind: TaskNoteKind }>(
  notes: readonly T[],
): T | null => {
  const open = openIn(conversationsOf(notes.map((each) => each.kind)));

  return open
    ? ([...notesIn(open, notes)]
        .reverse()
        .find((each) => each.kind === OPENS_A_CONVERSATION) ?? null)
    : null;
};

export const notesIn = <T>(
  conversation: Conversation,
  trail: readonly T[],
): T[] => conversation.from.throughIn(trail, conversation.to);

export const conversationsOf = (
  kinds: readonly TaskNoteKind[],
): Conversation[] => {
  const cut: Conversation[] = [];
  let open: NotePosition | null = null;

  for (const [index, kind] of kinds.entries()) {
    const at = NotePosition.of(index);

    if (kind === OPENS_A_CONVERSATION && open === null) {
      open = at;
      continue;
    }

    if (kind === CLOSES_A_CONVERSATION && open !== null) {
      cut.push({ from: open, to: at });
      open = null;
      continue;
    }

    if (kind === REOPENS_A_CONVERSATION && open === null) {
      open = cut.pop()?.from ?? null;
    }
  }

  if (open !== null) {
    cut.push({ from: open, to: null });
  }

  return cut;
};

export const REVIEW_STATES = ['pending', 'answered', 'moved-on'] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];

interface Review {
  readonly from: NotePosition;
  readonly state: ReviewState;
}

const sinceReopened = <T extends { kind: TaskNoteKind }>(
  notes: readonly T[],
): readonly T[] => {
  const reopened = notes
    .map((each) => each.kind)
    .lastIndexOf(REOPENS_A_CONVERSATION);

  return notes.slice(reopened + 1);
};

const reviewStateAfter = <T extends { kind: TaskNoteKind }>(
  notes: readonly T[],
  at: number,
): ReviewState => {
  const closing = sinceReopened(notes.slice(at + 1)).find(
    (later) =>
      later.kind === ANSWERS_A_QUESTION || later.kind === CLOSES_A_CONVERSATION,
  );

  if (!closing) {
    return 'pending';
  }

  return closing.kind === ANSWERS_A_QUESTION ? 'answered' : 'moved-on';
};

const containing = (cut: readonly Conversation[], at: NotePosition) =>
  cut.find(
    (each) =>
      each.from.isAtOrBefore(at) &&
      (each.to === null || at.isAtOrBefore(each.to)),
  );

export interface RunReview extends Review {
  readonly runId: RunId;
}

export const reviewsIn = <
  T extends { kind: TaskNoteKind; runId: RunId | null },
>(
  notes: readonly T[],
): readonly RunReview[] => {
  const reviews = new Map<string, RunReview>();
  const cut = conversationsOf(notes.map((each) => each.kind));

  notes.forEach((note, at) => {
    if (note.kind !== OPENS_A_CONVERSATION || !note.runId) {
      return;
    }

    const conversation = containing(cut, NotePosition.of(at));

    if (conversation) {
      reviews.set(note.runId.value, {
        runId: note.runId,
        from: conversation.from,
        state: reviewStateAfter(notes, at),
      });
    }
  });

  return [...reviews.values()];
};

export const awaitsAPerson = <T extends { kind: TaskNoteKind }>(
  notes: readonly T[],
): boolean => {
  let asked = -1;

  notes.forEach((note, at) => {
    if (note.kind === OPENS_A_CONVERSATION) {
      asked = at;
    }
  });

  return asked !== -1 && reviewStateAfter(notes, asked) === 'pending';
};

export const pendingIn = <T extends { kind: TaskNoteKind }>(
  notes: readonly T[],
): Conversation | null => {
  if (!awaitsAPerson(notes)) {
    return null;
  }

  return openIn(conversationsOf(notes.map((each) => each.kind)));
};

export const worksOn = <T extends { kind: TaskNoteKind }>(
  running: boolean,
  notes: readonly T[],
): boolean => running && !awaitsAPerson(notes);
