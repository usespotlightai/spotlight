import { InvalidCallbackNoteError } from '@integrations/domain/exceptions/invalid-callback-note.error';
import { CallbackNote } from '@integrations/domain/value-objects/callback-note.vo';
import { describe, expect, it } from 'vitest';

describe('CallbackNote', () => {
  it('says what it was given, without the space around it', () => {
    expect(CallbackNote.of('  Looks safe.  ').body).toBe('Looks safe.');
  });

  it('rejects a note that says nothing, or too much', () => {
    expect(() => CallbackNote.of('   ')).toThrow(InvalidCallbackNoteError);
    expect(() => CallbackNote.of('x'.repeat(20_001))).toThrow(
      InvalidCallbackNoteError,
    );
    expect(CallbackNote.of('x'.repeat(20_000)).body).toHaveLength(20_000);
  });
});
