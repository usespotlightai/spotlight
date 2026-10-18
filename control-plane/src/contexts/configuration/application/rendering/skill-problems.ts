import type { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const SKILLS = 'skills';

export const skillAt = (key: string): string => `${SKILLS}/${key}`;

export const SkillProblems = {
  immutableField(
    key: string,
    error: ImmutableFieldError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: skillAt(key),
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },
};
