import type { TaskNoteKind } from '@domain/value-objects/task-note.vo';

export interface Told {
  readonly kind: TaskNoteKind;
  readonly readAt: Date | null;
}

/** Stated here because the inbox reads a different shape than the task. */
export const unread = (note: Told): boolean =>
  note.kind === 'asked' && note.readAt === null;

export const anyUnread = (notes: readonly Told[]): boolean =>
  notes.some(unread);
