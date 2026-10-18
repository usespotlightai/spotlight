import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('IntegrationKey', () => {
  it('is the name of the integration', () => {
    expect(IntegrationKey.of('github').value).toBe('github');
    expect(IntegrationKey.of('  linear  ').value).toBe('linear');
  });

  it('says which words are its own to raise', () => {
    const linear = IntegrationKey.of('linear');

    expect(linear.raises(HappeningName.of('linear.issue.completed'))).toBe(
      true,
    );
    expect(linear.raises(HappeningName.of('github.checks.failed'))).toBe(false);
  });

  it('rejects anything but one lowercase word', () => {
    for (const named of ['GitHub', 'git hub', 'git.hub', 'git/hub', '', '-']) {
      expect(() => IntegrationKey.of(named)).toThrow(InvalidIdentifierError);
    }
  });

  it('is the same key as another spelled the same', () => {
    expect(
      IntegrationKey.of('github').equals(IntegrationKey.of('github')),
    ).toBe(true);
    expect(
      IntegrationKey.of('github').equals(IntegrationKey.of('linear')),
    ).toBe(false);
  });
});
