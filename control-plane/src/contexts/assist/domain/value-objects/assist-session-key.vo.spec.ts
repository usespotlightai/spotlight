import { InvalidAssistSessionError } from '@assist/domain/exceptions/invalid-assist-session.error';
import {
  AssistSessionKey,
  MAX_ASSIST_SESSION_KEY_LENGTH,
} from '@assist/domain/value-objects/assist-session-key.vo';
import { describe, expect, it } from 'vitest';

describe('AssistSessionKey', () => {
  it('takes a key of 1 to 255 characters', () => {
    expect(AssistSessionKey.of('judging:run_1:1').value).toBe(
      'judging:run_1:1',
    );
    expect(
      AssistSessionKey.of('k'.repeat(MAX_ASSIST_SESSION_KEY_LENGTH)).value,
    ).toHaveLength(MAX_ASSIST_SESSION_KEY_LENGTH);
  });

  it.each(['', '   ', 'k'.repeat(MAX_ASSIST_SESSION_KEY_LENGTH + 1)])(
    'refuses a blank or too long key',
    (key) => {
      expect(() => AssistSessionKey.of(key)).toThrow(InvalidAssistSessionError);
    },
  );

  it('is equal to a key of the same text', () => {
    expect(AssistSessionKey.of('a').equals(AssistSessionKey.of('a'))).toBe(
      true,
    );
    expect(AssistSessionKey.of('a').equals(AssistSessionKey.of('b'))).toBe(
      false,
    );
  });
});
