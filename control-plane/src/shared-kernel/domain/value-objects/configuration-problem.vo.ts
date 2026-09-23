import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

const PROBLEM_SEVERITIES = ['error', 'warning'] as const;

export type ProblemSeverity = (typeof PROBLEM_SEVERITIES)[number];

export class ConfigurationProblem {
  private constructor(
    readonly path: string,
    readonly field: FieldPath,
    readonly reason: string,
    readonly severity: ProblemSeverity,
  ) {}

  static of(input: {
    path: string;
    at: string | FieldPath;
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
      typeof input.at === 'string' ? FieldPath.dotted(input.at) : input.at,
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
      this.field.equals(other.field) &&
      this.reason === other.reason &&
      this.severity === other.severity
    );
  }
}
