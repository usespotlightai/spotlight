import { plainPreview } from '@/components/features/inbox/plainPreview';
import type { FoldedVisit, Note } from '@/lib/inbox';

export type PlacedVisits = {
  readonly before: ReadonlyMap<number, readonly FoldedVisit[]>;
  readonly after: readonly FoldedVisit[];
};

const firstLineOf = (body: string): string =>
  plainPreview(body.split('\n').find((line) => line.trim() !== '') ?? '');

const noteAt = (visit: FoldedVisit, position: number | null): Note | null =>
  position === null
    ? null
    : (visit.notes.find((note) => note.position === position) ?? null);

const closingOf = (visit: FoldedVisit): Note | null =>
  noteAt(visit, visit.closingAt);

export const answerOf = (visit: FoldedVisit): Note | null =>
  noteAt(visit, visit.answerAt);

export const headOf = (visit: FoldedVisit): Note | undefined => visit.notes[0];

export const previewOf = (visit: FoldedVisit): string =>
  firstLineOf((closingOf(visit) ?? visit.notes.at(-1))?.body ?? '');

export const endedAt = (visit: FoldedVisit): string | undefined =>
  visit.notes.at(-1)?.at;

export const placeVisits = (
  folded: readonly FoldedVisit[],
  shown: readonly Note[],
): PlacedVisits => {
  const before = new Map<number, FoldedVisit[]>();
  const after: FoldedVisit[] = [];

  for (const visit of folded) {
    const last = visit.notes.at(-1)?.position ?? -1;
    const next = shown.find((note) => note.position > last);

    if (next) {
      before.set(next.position, [...(before.get(next.position) ?? []), visit]);
    } else {
      after.push(visit);
    }
  }

  return { before, after };
};
