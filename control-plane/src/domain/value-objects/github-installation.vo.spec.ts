import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { describe, expect, it } from 'vitest';

describe('GitHubInstallation', () => {
  it('takes the number GitHub gave it', () => {
    expect(GitHubInstallation.of('81234567').value).toBe('81234567');
  });

  it('takes one with space around it, as a redirect leaves it', () => {
    expect(GitHubInstallation.of(' 81234567 ').value).toBe('81234567');
  });

  it.each(['', '  ', 'abc', '12a', '-1', '1.0', '12/34', '../../etc'])(
    'refuses %o, which GitHub would never have named',
    (raw) => {
      expect(() => GitHubInstallation.of(raw)).toThrow(InvalidIdentifierError);
    },
  );

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
