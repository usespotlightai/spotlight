import { InvalidNotePositionError } from '@work/domain/exceptions/invalid-note-position.error';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { describe, expect, it } from 'vitest';

describe('NotePosition', () => {
  it('is where a note stands in the trail', () => {
    expect(NotePosition.of(3).value).toBe(3);
  });

  it('refuses a place before the start', () => {
    expect(() => NotePosition.of(-1)).toThrow(InvalidNotePositionError);
  });

  it('refuses a place between two notes', () => {
    expect(() => NotePosition.of(1.5)).toThrow(InvalidNotePositionError);
  });

  it('knows what it stands at or before', () => {
    expect(NotePosition.of(2).isAtOrBefore(NotePosition.of(3))).toBe(true);
    expect(NotePosition.of(4).isAtOrBefore(NotePosition.of(3))).toBe(false);
  });
});
