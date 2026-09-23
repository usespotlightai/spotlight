import type { SkillKeyFixedError } from '@configuration/domain/exceptions/skill-key-fixed.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const SKILLS = 'skills';

export const skillAt = (key: string): string => `${SKILLS}/${key}`;

export const SkillProblems = {
  keyFixed(error: SkillKeyFixedError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: skillAt(error.key),
      at: error.field,
      reason: error.because,
    });
  },
};
