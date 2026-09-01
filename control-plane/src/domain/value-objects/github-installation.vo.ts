import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

const DIGITS = /^\d+$/;

/**
 * Which installation of the GitHub App a workspace works through. GitHub
 * numbers them, and the number is what mints a token, so a workspace without
 * one can reach no repository at all.
 */
export class GitHubInstallation {
  private readonly kind = 'github-installation';

  private constructor(readonly value: string) {}

  static of(value: string): GitHubInstallation {
    const trimmed = value.trim();

    // Named by GitHub rather than by us, and always a number: anything else
    // would be someone else's identifier standing in for one.
    if (!DIGITS.test(trimmed)) {
      throw new InvalidIdentifierError(
        'github installation',
        'is the number GitHub gave it',
      );
    }

    return new GitHubInstallation(trimmed);
  }

  equals(other: GitHubInstallation): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
