import { InvalidNotePositionError } from '@work/domain/exceptions/invalid-note-position.error';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { ReviewCommentHandle } from '@work/domain/value-objects/review-comment-handle.vo';
import { describe, expect, it } from 'vitest';

describe('ReviewCommentHandle', () => {
  it('names a review comment by where its note is', () => {
    expect(ReviewCommentHandle.for(NotePosition.of(3))).toBe('c3');
    expect(ReviewCommentHandle.of('c3')).toEqual(NotePosition.of(3));
  });

  it('reads one however it was typed', () => {
    expect(ReviewCommentHandle.of(' C12 ')).toEqual(NotePosition.of(12));
  });

  it('rejects what names no review comment', () => {
    for (const raw of ['', '3', 'c', 'cx', 'c-1', 'c3x']) {
      expect(() => ReviewCommentHandle.of(raw)).toThrow(
        InvalidNotePositionError,
      );
    }
  });
});
