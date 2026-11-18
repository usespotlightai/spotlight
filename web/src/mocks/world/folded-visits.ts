import type { FoldedVisitResponseDto, NoteResponseDto } from '@/lib/api';
import { perWorld } from '@/mocks/world';

const visitNotes = perWorld(() => new Map<string, NoteResponseDto[]>());

const visitKey = (taskId: string, from: number, to: number) =>
  `${taskId}:${from}:${to}`;

export const notesBetween = (
  taskId: string,
  from: number,
  to: number,
): NoteResponseDto[] => visitNotes().get(visitKey(taskId, from, to)) ?? [];

const visitsIn = (trail: readonly NoteResponseDto[]): NoteResponseDto[][] =>
  trail.reduce<NoteResponseDto[][]>((visits, note) => {
    const current = visits.at(-1);

    if (current?.[0]?.station === note.station) {
      current.push(note);
    } else {
      visits.push([note]);
    }

    return visits;
  }, []);

const stretchesOf = (
  visit: readonly NoteResponseDto[],
  shown: ReadonlySet<number>,
): NoteResponseDto[][] =>
  visit.reduce<NoteResponseDto[][]>((stretches, note, at) => {
    if (shown.has(note.position)) {
      return stretches;
    }

    const previous = visit[at - 1];

    if (previous && !shown.has(previous.position)) {
      stretches.at(-1)?.push(note);
    } else {
      stretches.push([note]);
    }

    return stretches;
  }, []);

export const foldedAround = (
  taskId: string,
  trail: readonly NoteResponseDto[],
  shown: readonly NoteResponseDto[],
): FoldedVisitResponseDto[] => {
  const visible = new Set(shown.map((note) => note.position));
  const visits = visitsIn(trail);

  return visits.flatMap((visit, at) => {
    const next = visits[at + 1]?.[0];

    return stretchesOf(visit, visible).flatMap((notes) => {
      const first = notes[0];
      const end = notes.at(-1);

      if (!first || !end) {
        return [];
      }

      const closing =
        end === visit.at(-1) && end.kind === 'passed' ? end : null;
      visitNotes().set(visitKey(taskId, first.position, end.position), notes);

      return [
        {
          first,
          to: end.position,
          endedAt: end.at,
          closing,
          answer:
            notes.findLast(
              (note) => note.voice === 'person' && note.kind === 'answered',
            ) ?? null,
          sentBack: Boolean(
            closing && next && next.stationPosition < closing.stationPosition,
          ),
        },
      ];
    });
  });
};

export const lastConversationIn = (
  trail: readonly NoteResponseDto[],
): NoteResponseDto[] => {
  const from = trail.findLastIndex((note, at) => {
    const before = trail.slice(0, at);
    const lastAsked = before.findLastIndex((each) => each.kind === 'asked');
    const lastPassed = before.findLastIndex((each) => each.kind === 'passed');

    return note.kind === 'asked' && lastPassed >= lastAsked;
  });

  if (from < 0) {
    return [...trail];
  }

  const to = trail.findIndex((note, at) => at > from && note.kind === 'passed');

  return trail.slice(from, to < 0 ? undefined : to + 1);
};
