import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('GitHubInstallation', () => {
  it('takes the number GitHub gave it', () => {
    expect(GitHubInstallation.of('81234567').value).toBe('81234567');
  });

  it('takes one with space around it, as a redirect leaves it', () => {
    expect(GitHubInstallation.of(' 81234567 ').value).toBe('81234567');
  });

  it.each(['', '  ', 'abc', '12a', '-1', '1.0', '12/34', '../../etc'])(
    'rejects %o, which GitHub would never have named',
    (raw) => {
      expect(() => GitHubInstallation.of(raw)).toThrow(InvalidIdentifierError);
    },
  );

  it('reads nothing from what GitHub would never have named', () => {
    expect(GitHubInstallation.parsed('abc')).toBeNull();
    expect(GitHubInstallation.parsed(' 42 ')?.value).toBe('42');
  });

  it('is the same installation as one written the same way', () => {
    expect(
      GitHubInstallation.of('42').equals(GitHubInstallation.of('42')),
    ).toBe(true);
  });

  it('is not the same as another', () => {
    expect(
      GitHubInstallation.of('42').equals(GitHubInstallation.of('43')),
    ).toBe(false);
  });
});
