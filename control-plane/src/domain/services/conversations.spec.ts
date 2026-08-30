import {
  conversationsOf,
  notesIn,
  stillOpen,
} from '@domain/services/conversations';
import type { TaskNoteKind } from '@domain/value-objects/task-note.vo';
import { describe, expect, it } from 'vitest';

const trail = (...kinds: TaskNoteKind[]) => conversationsOf(kinds);

describe('conversationsOf', () => {
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

describe('stillOpen', () => {
  it('holds while nothing has closed it', () => {
    expect(stillOpen({ from: 0, to: null })).toBe(true);
  });

  it('does not once something has', () => {
    expect(stillOpen({ from: 0, to: 2 })).toBe(false);
  });
});

describe('notesIn', () => {
  const trail = ['a', 'b', 'c', 'd'];

  it('covers the note that opened it through the one that closed it', () => {
    expect(notesIn({ from: 1, to: 2 }, trail)).toEqual(['b', 'c']);
  });

  it('runs to the end of the trail while it is still open', () => {
    expect(notesIn({ from: 1, to: null }, trail)).toEqual(['b', 'c', 'd']);
  });
});
