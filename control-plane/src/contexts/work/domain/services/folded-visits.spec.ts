import type { TaskNoteKind } from '@work/domain/entities/task-note.entity';
import { foldedVisits } from '@work/domain/services/folded-visits';
import type { VoiceKind } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const STATIONS = {
  plan: 1,
  implementation: 2,
  review: 3,
} as const;

type Station = keyof typeof STATIONS;

const trailOf = (
  ...notes: [Station, TaskNoteKind, VoiceKind?][]
): {
  position: number;
  kind: TaskNoteKind;
  voice: VoiceKind;
  stationId: string;
  stationPosition: number;
}[] =>
  notes.map(([station, kind, voice], position) => ({
    position,
    kind,
    voice: voice ?? 'station',
    stationId: station,
    stationPosition: STATIONS[station],
  }));

const positionsOf = (folded: ReturnType<typeof foldedVisits>) =>
  folded.map((each) => each.notes.map((note) => note.position));

describe('foldedVisits', () => {
  const handedOn = trailOf(
    ['plan', 'asked'],
    ['plan', 'answered', 'person'],
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
    const [plan, implementation] = foldedVisits(handedOn, new Set([5]));

    expect(plan?.closing?.position).toBe(2);
    expect(implementation?.closing?.position).toBe(4);
  });

  it('takes the last answer of a person in the visit', () => {
    const [plan, implementation] = foldedVisits(handedOn, new Set([5]));

    expect(plan?.answer?.position).toBe(1);
    expect(implementation?.answer).toBeNull();
  });

  it('marks a visit that sent the task back to an earlier station', () => {
    const reworked = trailOf(
      ['implementation', 'passed'],
      ['review', 'asked'],
      ['review', 'answered', 'person'],
      ['review', 'passed'],
      ['implementation', 'message'],
    );

    expect(
      foldedVisits(reworked, new Set([4])).map((each) => each.sentBack),
    ).toEqual([false, true]);
  });

  it('folds the stretches around shown notes inside one visit apart', () => {
    const atOneStation = trailOf(
      ['implementation', 'message'],
      ['implementation', 'asked'],
      ['implementation', 'answered', 'person'],
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
    const [review] = foldedVisits(
      trailOf(['review', 'asked'], ['plan', 'asked']),
      new Set([1]),
    );

    expect(review?.closing).toBeNull();
    expect(review?.sentBack).toBe(false);
  });
});
