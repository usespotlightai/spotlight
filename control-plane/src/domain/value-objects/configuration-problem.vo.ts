import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/** What is wrong with a file, and where, in the words of whoever fixes it. */
export class ConfigurationProblem {
  private constructor(
    readonly path: string,
    /** Where in the file, as it is written there. */
    readonly at: string,
    readonly reason: string,
  ) {}

  static of(input: {
    path: string;
    at: string;
    reason: string;
  }): ConfigurationProblem {
    const reason = input.reason.trim();

    // A problem nobody can act on is worse than none: it says something is
    // wrong and leaves the reader no better off.
    if (reason.length === 0) {
      throw new InvalidIdentifierError(
        'configuration problem',
        'says what to do about it',
      );
    }

    return new ConfigurationProblem(
      input.path.trim(),
      input.at.trim() || 'the file',
      reason,
    );
  }

  isIn(path: string): boolean {
    return this.path === path;
  }

  equals(other: ConfigurationProblem): boolean {
    return (
      this.path === other.path &&
      this.at === other.at &&
      this.reason === other.reason
    );
  }
}
