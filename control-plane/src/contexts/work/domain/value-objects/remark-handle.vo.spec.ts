import { InvalidNotePositionError } from '@work/domain/exceptions/invalid-note-position.error';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { RemarkHandle } from '@work/domain/value-objects/remark-handle.vo';
import { describe, expect, it } from 'vitest';

describe('RemarkHandle', () => {
  it('names a remark by where its note is', () => {
    expect(RemarkHandle.for(NotePosition.of(3))).toBe('c3');
    expect(RemarkHandle.of('c3')).toEqual(NotePosition.of(3));
  });

  it('reads one however it was typed', () => {
    expect(RemarkHandle.of(' C12 ')).toEqual(NotePosition.of(12));
  });

  it('refuses what names no remark', () => {
    for (const said of ['', '3', 'c', 'cx', 'c-1', 'c3x']) {
      expect(() => RemarkHandle.of(said)).toThrow(InvalidNotePositionError);
    }
  });
});
