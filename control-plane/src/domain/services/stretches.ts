import type { TaskNoteKind } from '@domain/value-objects/task-note.vo';

/** One run of the trail a person owns, by position. */
export interface Stretch {
  readonly from: number;
  // Where it was closed, or absent while it is still theirs.
  readonly to: number | null;
}

/**
 * Cuts a task's trail into the stretches a person owns: an 'asked' opens one
 * and a 'passed' closes it. Asking again inside an open one is the same
 * conversation carrying on, not a second thing owed.
 */
export const stretchesOf = (kinds: readonly TaskNoteKind[]): Stretch[] => {
  const cut: Stretch[] = [];
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
