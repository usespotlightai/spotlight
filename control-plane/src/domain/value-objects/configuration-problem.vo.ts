import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/**
 * What is wrong with a file, in the words of whoever has to fix it.
 *
 * A problem points at where it is the way a person would — a file, and a
 * field within it — so the answer to "why is my integration not running" is
 * a list to work through rather than a stack trace to interpret.
 */
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
}
