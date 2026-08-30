import { stretchesOf } from '@domain/services/stretches';
import type { TaskNoteKind } from '@domain/value-objects/task-note.vo';
import { describe, expect, it } from 'vitest';

const trail = (...kinds: TaskNoteKind[]) => stretchesOf(kinds);

describe('stretchesOf', () => {
  it('finds nothing in a trail nobody was asked about', () => {
    expect(trail('passed', 'passed')).toEqual([]);
  });

  it('opens at the asking and closes at the moving on', () => {
    expect(trail('passed', 'asked', 'answered', 'passed')).toEqual([
      { from: 1, to: 3 },
    ]);
  });

  it('leaves the last one open where nothing has closed it', () => {
    expect(trail('asked', 'answered')).toEqual([{ from: 0, to: null }]);
  });

  // Asked, answered, asked again: still one thing owed, not two.
  it('takes a follow-up as the same conversation carrying on', () => {
    expect(trail('asked', 'answered', 'asked')).toEqual([
      { from: 0, to: null },
    ]);
  });

  // What was settled stays settled; needing someone again is a new thing.
  it('opens a second one only after the first has closed', () => {
    expect(trail('asked', 'passed', 'asked')).toEqual([
      { from: 0, to: 1 },
      { from: 2, to: null },
    ]);
  });

  it('ignores a moving on that closed nothing', () => {
    expect(trail('passed', 'asked', 'passed', 'passed')).toEqual([
      { from: 1, to: 2 },
    ]);
  });
});
