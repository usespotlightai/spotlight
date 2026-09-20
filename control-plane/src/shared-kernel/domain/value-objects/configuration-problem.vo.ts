import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

const PROBLEM_SEVERITIES = ['error', 'warning'] as const;

export type ProblemSeverity = (typeof PROBLEM_SEVERITIES)[number];

export class ConfigurationProblem {
  private constructor(
    readonly path: string,
    readonly at: string,
    readonly reason: string,
    readonly severity: ProblemSeverity,
  ) {}

  static of(input: {
    path: string;
    at: string;
    reason: string;
    severity?: ProblemSeverity;
  }): ConfigurationProblem {
    const reason = input.reason.trim();

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
      input.severity ?? 'error',
    );
  }

  get isWarning(): boolean {
    return this.severity === 'warning';
  }

  isIn(path: string): boolean {
    return this.path === path;
  }

  equals(other: ConfigurationProblem): boolean {
    return (
      this.path === other.path &&
      this.at === other.at &&
      this.reason === other.reason &&
      this.severity === other.severity
    );
  }
}
