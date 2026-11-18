import type { TaskNoteKind } from '@work/domain/entities/task-note.entity';
import type { VoiceKind } from '@work/domain/value-objects/voice.vo';

export interface VisitedNote {
  readonly position: number;
  readonly kind: TaskNoteKind;
  readonly voice: VoiceKind;
  readonly stationId: string;
  readonly stationPosition: number;
}

export interface FoldedVisit<T extends VisitedNote> {
  readonly notes: readonly T[];
  readonly closing: T | null;
  readonly answer: T | null;
  readonly sentBack: boolean;
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

    const previous = visit[at - 1];

    if (previous && !shown.has(previous.position)) {
      lastOf(stretches)?.push(note);
    } else {
      stretches.push([note]);
    }

    return stretches;
  }, []);

const answerIn = <T extends VisitedNote>(notes: readonly T[]): T | null =>
  lastOf(
    notes.filter((note) => note.voice === 'person' && note.kind === 'answered'),
  ) ?? null;

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
      const closing = end && end === last && end.kind === 'passed' ? end : null;

      return {
        notes,
        closing,
        answer: answerIn(notes),
        sentBack: Boolean(
          closing && next && next.stationPosition < closing.stationPosition,
        ),
      };
    });
  });
};
