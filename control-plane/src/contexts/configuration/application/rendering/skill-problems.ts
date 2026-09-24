import type { SkillKeyFixedError } from '@configuration/domain/exceptions/skill-key-fixed.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const SKILLS = 'skills';

export const skillAt = (key: string): string => `${SKILLS}/${key}`;

export const SkillProblems = {
  keyFixed(error: SkillKeyFixedError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: skillAt(error.key),
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },
};
