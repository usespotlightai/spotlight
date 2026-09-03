import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import { Happening } from '@domain/value-objects/happening.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { describe, expect, it } from 'vitest';

describe('SourceKey', () => {
  it('is the one word a host is addressed by', () => {
    expect(SourceKey.of('github').value).toBe('github');
    expect(SourceKey.of('  linear  ').value).toBe('linear');
  });

  it('says which words are its own to raise', () => {
    const linear = SourceKey.of('linear');

    expect(linear.raises(Happening.of('linear.issue.completed'))).toBe(true);
    expect(linear.raises(Happening.of('github.checks.failed'))).toBe(false);
  });

  // It is a segment of an address and the first part of every word it raises,
  // and both would read ambiguously with a stop or a slash in it.
  it('refuses anything but one lowercase word', () => {
    for (const named of ['GitHub', 'git hub', 'git.hub', 'git/hub', '', '-']) {
      expect(() => SourceKey.of(named)).toThrow(InvalidIdentifierError);
    }
  });

  it('is the same source as another spelled the same', () => {
    expect(SourceKey.of('github').equals(SourceKey.of('github'))).toBe(true);
    expect(SourceKey.of('github').equals(SourceKey.of('linear'))).toBe(false);
  });
});
