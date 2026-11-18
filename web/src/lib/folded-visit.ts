import { plainPreview } from '@/components/features/inbox/plainPreview';
import type { FoldedVisit, Note } from '@/lib/inbox';

export type PlacedVisits = {
  readonly before: ReadonlyMap<number, readonly FoldedVisit[]>;
  readonly after: readonly FoldedVisit[];
};

const firstLineOf = (body: string): string =>
  plainPreview(body.split('\n').find((line) => line.trim() !== '') ?? '');

export const previewOf = (visit: FoldedVisit): string =>
  firstLineOf((visit.closing ?? visit.first).body);

export const placeVisits = (
  folded: readonly FoldedVisit[],
  shown: readonly Note[],
): PlacedVisits => {
  const before = new Map<number, FoldedVisit[]>();
  const after: FoldedVisit[] = [];

  for (const visit of folded) {
    const next = shown.find((note) => note.position > visit.to);

    if (next) {
      before.set(next.position, [...(before.get(next.position) ?? []), visit]);
    } else {
      after.push(visit);
    }
  }

  return { before, after };
};
