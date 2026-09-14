import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import type { Connection } from '@domain/value-objects/connection.vo';

const DIGITS = /^\d+$/;

export class GitHubInstallation {
  static readonly SOURCE = 'github';

  private readonly kind = 'github-installation';

  private constructor(readonly value: string) {}

  static from(connection: Connection | null): GitHubInstallation | null {
    return connection?.isTo(GitHubInstallation.SOURCE)
      ? GitHubInstallation.of(connection.externalId)
      : null;
  }

  static of(value: string): GitHubInstallation {
    const trimmed = value.trim();

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
