import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  TaskNoteForm,
  TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
import { anyUnread, type ReadableNote } from '@work/domain/services/unread';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';

const OPENS_A_CONVERSATION = 'asked' satisfies TaskNoteKind;

const CLOSES_A_CONVERSATION = 'passed' satisfies TaskNoteKind;

const REOPENS_A_CONVERSATION = 'reopened' satisfies TaskNoteKind;

const ANSWERS_A_QUESTION = 'answered' satisfies TaskNoteKind;

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

export const listedAsOpen = <T>(
  conversation: {
    readonly from: T;
    readonly to: T | null;
    readonly notes: readonly ReadableNote[];
  },
  taskFinished: boolean,
): boolean =>
  stillOpen(conversation) ? !taskFinished : anyUnread(conversation.notes);

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

export const notesIn = <T>(
  conversation: Conversation,
  trail: readonly T[],
): T[] => conversation.from.throughIn(trail, conversation.to);

export const conversationsOf = (
  kinds: readonly TaskNoteKind[],
): Conversation[] => {
  const cut: Conversation[] = [];
  let open: NotePosition | null = null;

  kinds.forEach((kind, index) => {
    const at = NotePosition.of(index);

    if (kind === OPENS_A_CONVERSATION && open === null) {
      open = at;
      return;
    }

    if (kind === CLOSES_A_CONVERSATION && open !== null) {
      cut.push({ from: open, to: at });
      open = null;
      return;
    }

    if (kind === REOPENS_A_CONVERSATION && open === null) {
      open = cut.pop()?.from ?? null;
    }
  });

  if (open !== null) {
    cut.push({ from: open, to: null });
  }

  return cut;
};

export type ReviewState = 'pending' | 'answered';

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

const answeredAfter = <T extends { kind: TaskNoteKind }>(
  notes: readonly T[],
  at: number,
): boolean =>
  sinceReopened(notes.slice(at + 1)).some(
    (later) =>
      later.kind === ANSWERS_A_QUESTION || later.kind === CLOSES_A_CONVERSATION,
  );

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
        state: answeredAfter(notes, at) ? 'answered' : 'pending',
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
