import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('SourceKey', () => {
  it('is the one word a host is addressed by', () => {
    expect(SourceKey.of('github').value).toBe('github');
    expect(SourceKey.of('  linear  ').value).toBe('linear');
  });

  it('says which words are its own to raise', () => {
    const linear = SourceKey.of('linear');

    expect(linear.raises(HappeningName.of('linear.issue.completed'))).toBe(
      true,
    );
    expect(linear.raises(HappeningName.of('github.checks.failed'))).toBe(false);
  });

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
