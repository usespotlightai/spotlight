import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const CandidateProblems = {
  name(reason: string): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: '',
      at: FieldPath.of(['name']),
      reason,
    });
  },
};
