import type { TaskNoteKind } from '@work/domain/entities/task-note.entity';

export interface DeferralFacts {
  readonly kind: TaskNoteKind;
  readonly approval: unknown;
  readonly deferredMove: unknown;
}

const drops = (note: DeferralFacts): boolean =>
  note.kind === 'passed' || (note.kind === 'asked' && note.approval === null);

export const deferralIn = <T extends DeferralFacts>(
  notes: readonly T[],
): T | null => {
  for (const note of [...notes].reverse()) {
    if (note.deferredMove !== null) {
      return note;
    }

    if (drops(note)) {
      return null;
    }
  }

  return null;
};

export const deferralWaitingIn = <T extends DeferralFacts>(
  notes: readonly T[],
  running: boolean,
): T | null => (running ? deferralIn(notes) : null);
