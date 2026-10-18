import type { TaskNoteKind } from '@work/domain/entities/task-note.entity';

export interface ReadableNote {
  readonly kind: TaskNoteKind;
  readonly readAt: Date | null;
}

export const unread = (note: ReadableNote): boolean =>
  note.kind === 'asked' && note.readAt === null;

export const anyUnread = (notes: readonly ReadableNote[]): boolean =>
  notes.some(unread);
