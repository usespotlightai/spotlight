import { firstOf, itemAt } from '@shared-kernel/domain/item-at';
import type { TaskNoteKind } from '@work/domain/entities/task-note.entity';
import { foldedVisits } from '@work/domain/services/folded-visits';
import { describe, expect, it } from 'vitest';

const STATIONS = {
  plan: 1,
  implementation: 2,
  review: 3,
} as const;

type Station = keyof typeof STATIONS;

const trailOf = (
  ...notes: [Station, TaskNoteKind][]
): {
  position: number;
  kind: TaskNoteKind;
  stationId: string;
  stationPosition: number | null;
}[] =>
  notes.map(([station, kind], position) => ({
    position,
    kind,
    stationId: station,
    stationPosition: STATIONS[station],
  }));

const positionsOf = (folded: ReturnType<typeof foldedVisits>) =>
  folded.map((each) => each.notes.map((note) => note.position));

describe('foldedVisits', () => {
  const handedOn = trailOf(
    ['plan', 'asked'],
    ['plan', 'answered'],
    ['plan', 'passed'],
    ['implementation', 'message'],
    ['implementation', 'passed'],
    ['review', 'asked'],
  );

  it('folds each earlier station visit on its own', () => {
    expect(positionsOf(foldedVisits(handedOn, new Set([5])))).toEqual([
      [0, 1, 2],
      [3, 4],
    ]);
  });

  it('folds nothing that is shown', () => {
    expect(foldedVisits(handedOn, new Set([0, 1, 2, 3, 4, 5]))).toEqual([]);
  });

  it('takes the moving on as the closing note of a visit', () => {
    const visits = foldedVisits(handedOn, new Set([5]));
    const plan = firstOf(visits);
    const implementation = itemAt(visits, 1);

    expect(plan?.closing?.position).toBe(2);
    expect(implementation?.closing?.position).toBe(4);
  });

  it('takes the answers of the visit', () => {
    const visits = foldedVisits(handedOn, new Set([5]));
    const plan = firstOf(visits);
    const implementation = itemAt(visits, 1);

    expect(plan?.answers.map((note) => note.position)).toEqual([1]);
    expect(implementation?.answers).toEqual([]);
  });

  it('takes every answer of the visit, oldest first', () => {
    const answeredTwice = trailOf(
      ['review', 'asked'],
      ['review', 'answered'],
      ['review', 'answered'],
      ['review', 'passed'],
      ['implementation', 'message'],
    );

    const review = firstOf(foldedVisits(answeredTwice, new Set([4])));

    expect(review?.answers.map((note) => note.position)).toEqual([1, 2]);
  });

  it('marks a visit whose station passed the task back to an earlier station', () => {
    const reworked = trailOf(
      ['implementation', 'passed'],
      ['review', 'asked'],
      ['review', 'answered'],
      ['review', 'passed'],
      ['implementation', 'message'],
    );

    expect(
      foldedVisits(reworked, new Set([4])).map((each) => each.passedBack),
    ).toEqual([false, true]);
  });

  it('does not mark a pass back when a station position is unknown', () => {
    const removed = trailOf(
      ['review', 'passed'],
      ['implementation', 'message'],
    ).map((note) =>
      note.stationId === 'review' ? { ...note, stationPosition: null } : note,
    );

    expect(
      foldedVisits(removed, new Set([1])).map((each) => each.passedBack),
    ).toEqual([false]);
  });

  it('folds the stretches around shown notes inside one visit apart', () => {
    const atOneStation = trailOf(
      ['implementation', 'message'],
      ['implementation', 'asked'],
      ['implementation', 'answered'],
      ['implementation', 'passed'],
    );

    const folded = foldedVisits(atOneStation, new Set([1, 2]));

    expect(positionsOf(folded)).toEqual([[0], [3]]);
    expect(folded.map((each) => each.closing?.position ?? null)).toEqual([
      null,
      3,
    ]);
  });

  it('gives a visit no closing note when the task has not moved on', () => {
    const review = firstOf(
      foldedVisits(
        trailOf(['review', 'asked'], ['plan', 'asked']),
        new Set([1]),
      ),
    );

    expect(review?.closing).toBeNull();
    expect(review?.passedBack).toBe(false);
  });
});
