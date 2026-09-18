import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { describe, expect, it } from 'vitest';

describe('StationKey', () => {
  it('is lowercase words joined by dashes', () => {
    expect(StationKey.of('code-review').value).toBe('code-review');
    expect(() => StationKey.of('Code Review')).toThrow(InvalidIdentifierError);
  });

  it('is read without the space around it', () => {
    expect(StationKey.of('  spec ').value).toBe('spec');
  });

  it('is at most 64 characters', () => {
    expect(StationKey.of('a'.repeat(64)).value).toHaveLength(64);
    expect(() => StationKey.of('a'.repeat(65))).toThrow(InvalidIdentifierError);
  });

  it('is never a word a run hands over with rather than a station', () => {
    expect(() => StationKey.of('review')).toThrow(/is never review/);
    expect(() => StationKey.of('done')).toThrow(/is never done/);
    expect(() => StationKey.of(' review ')).toThrow(InvalidIdentifierError);
  });

  it('is the same key as another with the same words', () => {
    expect(StationKey.of('spec').equals(StationKey.of('spec'))).toBe(true);
    expect(StationKey.of('spec').equals(StationKey.of('triage'))).toBe(false);
  });
});
