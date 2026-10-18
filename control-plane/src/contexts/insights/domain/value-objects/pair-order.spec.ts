import {
  pairOrderOf,
  winnerOf,
} from '@insights/domain/value-objects/pair-order';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

describe('pairOrderOf', () => {
  it('draws the same order for the same two runs, every time', () => {
    const run = RunId.of('replay_1');
    const other = RunId.of('replay_2');

    expect(pairOrderOf(run, other)).toBe(pairOrderOf(run, other));
  });

  it('shows the run first for some pairs and second for others', () => {
    const orders = new Set(
      Array.from({ length: 40 }, (_, at) =>
        pairOrderOf(RunId.of(`run_${at}`), RunId.of(`against_${at}`)),
      ),
    );

    expect(orders).toEqual(new Set(['run-first', 'other-first']));
  });
});

describe('winnerOf', () => {
  it('maps the label the judge preferred back to the run it showed there', () => {
    expect(winnerOf('run-first', 'A')).toBe('run');
    expect(winnerOf('run-first', 'B')).toBe('other');
    expect(winnerOf('other-first', 'A')).toBe('other');
    expect(winnerOf('other-first', 'B')).toBe('run');
    expect(winnerOf('other-first', 'tie')).toBe('tie');
  });
});
