import {
  pairOrderOf,
  winnerOf,
} from '@outcomes/domain/value-objects/pair-order';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

describe('pairOrderOf', () => {
  it('draws the same order for the same two runs, every time', () => {
    const run = RunId.of('replay_1');
    const against = RunId.of('replay_2');

    expect(pairOrderOf(run, against)).toBe(pairOrderOf(run, against));
  });

  it('shows the run first for some pairs and second for others', () => {
    const orders = new Set(
      Array.from({ length: 40 }, (_, at) =>
        pairOrderOf(RunId.of(`run_${at}`), RunId.of(`against_${at}`)),
      ),
    );

    expect(orders).toEqual(new Set(['run-first', 'against-first']));
  });
});

describe('winnerOf', () => {
  it('maps the label the judge preferred back to the run it showed there', () => {
    expect(winnerOf('run-first', 'A')).toBe('run');
    expect(winnerOf('run-first', 'B')).toBe('against');
    expect(winnerOf('against-first', 'A')).toBe('against');
    expect(winnerOf('against-first', 'B')).toBe('run');
    expect(winnerOf('against-first', 'tie')).toBe('tie');
  });
});
