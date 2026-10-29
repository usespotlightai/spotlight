import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: ConfigurationProblem };

export const CandidateProblems = {
  name(reason: string): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: '',
      at: FieldPath.of(['name']),
      reason,
    });
  },

  hypothesis(reason: string): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: '',
      at: FieldPath.of(['hypothesis']),
      reason,
    });
  },

  parsed<T>(
    made: () => T,
    problemOf: (reason: string) => ConfigurationProblem,
  ): Parsed<T> {
    try {
      return { ok: true, value: made() };
    } catch (error) {
      if (error instanceof InvalidCandidateError) {
        return { ok: false, problem: problemOf(error.reason) };
      }
      throw error;
    }
  },
};
