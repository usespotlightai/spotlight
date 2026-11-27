import { itemAt } from '@shared-kernel/domain/item-at';
import type { TaskNoteKind } from '@work/domain/entities/task-note.entity';
import {
  ANSWERS_A_QUESTION,
  CLOSES_A_CONVERSATION,
} from '@work/domain/services/conversations';

export interface VisitedNote {
  readonly position: number;
  readonly kind: TaskNoteKind;
  readonly stationId: string;
  readonly stationPosition: number | null;
}

export interface FoldedVisit<T extends VisitedNote> {
  readonly notes: readonly T[];
  readonly closing: T | null;
  readonly answers: readonly T[];
  readonly passedBack: boolean;
}

const lastOf = <T>(list: readonly T[]): T | undefined => list[list.length - 1];

const visitsIn = <T extends VisitedNote>(trail: readonly T[]): T[][] =>
  trail.reduce<T[][]>((visits, note) => {
    const current = lastOf(visits);

    if (current?.[0]?.stationId === note.stationId) {
      current.push(note);
    } else {
      visits.push([note]);
    }

    return visits;
  }, []);

const stretchesOf = <T extends VisitedNote>(
  visit: readonly T[],
  shown: ReadonlySet<number>,
): T[][] =>
  visit.reduce<T[][]>((stretches, note, at) => {
    if (shown.has(note.position)) {
      return stretches;
    }

    const previous = itemAt(visit, at - 1);

    if (previous !== undefined && !shown.has(previous.position)) {
      lastOf(stretches)?.push(note);
    } else {
      stretches.push([note]);
    }

    return stretches;
  }, []);

const answersIn = <T extends VisitedNote>(notes: readonly T[]): T[] =>
  notes.filter((note) => note.kind === ANSWERS_A_QUESTION);

const passesBack = (
  closing: VisitedNote | null,
  next: VisitedNote | undefined,
): boolean => {
  const from = closing?.stationPosition ?? null;
  const to = next?.stationPosition ?? null;

  return from !== null && to !== null && to < from;
};

export const foldedVisits = <T extends VisitedNote>(
  trail: readonly T[],
  shown: ReadonlySet<number>,
): FoldedVisit<T>[] => {
  const visits = visitsIn(trail);

  return visits.flatMap((visit, at) => {
    const last = lastOf(visit);
    const next = visits[at + 1]?.[0];

    return stretchesOf(visit, shown).map((notes) => {
      const end = lastOf(notes);
      const closing =
        end && end === last && end.kind === CLOSES_A_CONVERSATION ? end : null;

      return {
        notes,
        closing,
        answers: answersIn(notes),
        passedBack: passesBack(closing, next),
      };
    });
  });
};
