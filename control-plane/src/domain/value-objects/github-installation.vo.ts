import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import type { Connection } from '@domain/value-objects/connection.vo';

const DIGITS = /^\d+$/;

/**
 * Which installation of the GitHub App a workspace works through. GitHub
 * numbers them, and the number is what mints a token, so a workspace without
 * one can reach no repository at all.
 */
export class GitHubInstallation {
  /** The name GitHub's source is addressed by, and its connections keyed on. */
  static readonly SOURCE = 'github';

  private readonly kind = 'github-installation';

  private constructor(readonly value: string) {}

  /** The number behind a workspace's connection to GitHub, where it has one. */
  static from(connection: Connection | null): GitHubInstallation | null {
    return connection?.isTo(GitHubInstallation.SOURCE)
      ? GitHubInstallation.of(connection.externalId)
      : null;
  }

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
