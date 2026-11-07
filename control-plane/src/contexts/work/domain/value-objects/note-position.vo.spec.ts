import { InvalidNotePositionError } from '@work/domain/exceptions/invalid-note-position.error';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { describe, expect, it } from 'vitest';

describe('NotePosition', () => {
  it('is where a note is in the trail', () => {
    expect(NotePosition.of(3).value).toBe(3);
  });

  it('rejects a place before the start', () => {
    expect(() => NotePosition.of(-1)).toThrow(InvalidNotePositionError);
  });

  it('rejects a place between two notes', () => {
    expect(() => NotePosition.of(1.5)).toThrow(InvalidNotePositionError);
  });

  it('knows what it is at or before', () => {
    expect(NotePosition.of(2).isAtOrBefore(NotePosition.of(3))).toBe(true);
    expect(NotePosition.of(4).isAtOrBefore(NotePosition.of(3))).toBe(false);
  });

  it('moves on to the next note', () => {
    expect(NotePosition.of(2).next().equals(NotePosition.of(3))).toBe(true);
  });

  it('finds its note in a trail', () => {
    expect(NotePosition.of(1).noteIn(['a', 'b'])).toBe('b');
    expect(NotePosition.of(2).noteIn(['a', 'b'])).toBeUndefined();
  });

  it('covers a trail from itself through the last note it is given', () => {
    const trail = ['a', 'b', 'c', 'd'];

    expect(NotePosition.of(1).throughIn(trail, NotePosition.of(2))).toEqual([
      'b',
      'c',
    ]);
    expect(NotePosition.of(1).throughIn(trail, null)).toEqual(['b', 'c', 'd']);
  });

  it('knows the last note of a trail and where the next one goes', () => {
    expect(NotePosition.lastIn([])).toBeNull();
    expect(NotePosition.lastIn(['a', 'b'])?.value).toBe(1);
    expect(NotePosition.nextIn(['a', 'b']).value).toBe(2);
  });
});
