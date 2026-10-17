import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { RecallWords } from '@memory/domain/value-objects/recall-words.vo';
import { describe, expect, it } from 'vitest';

describe('RecallWords', () => {
  it('keeps the words a run looks for, trimmed', () => {
    expect(RecallWords.of('  upload retries ').value).toBe('upload retries');
  });

  it('refuses nothing to look for, or too much', () => {
    expect(() => RecallWords.of('   ')).toThrow(InvalidMemoryError);
    expect(() => RecallWords.of('x'.repeat(501))).toThrow(InvalidMemoryError);
  });
});
