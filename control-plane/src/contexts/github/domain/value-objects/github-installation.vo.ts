import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

const DIGITS = /^\d+$/;

export class GitHubInstallation {
  private readonly kind = 'github-installation';

  private constructor(readonly value: string) {}

  static of(value: string): GitHubInstallation {
    const installation = GitHubInstallation.parsed(value);

    if (!installation) {
      throw new InvalidIdentifierError(
        'GitHub installation',
        'must be the number GitHub gave it',
      );
    }

    return installation;
  }

  static parsed(value: string): GitHubInstallation | null {
    const trimmed = value.trim();

    return DIGITS.test(trimmed) ? new GitHubInstallation(trimmed) : null;
  }

  equals(other: GitHubInstallation): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
