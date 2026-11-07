import type { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { SkillKeyReservedError } from '@configuration/domain/exceptions/skill-key-reserved.error';
import { SkillMainFileMissingError } from '@configuration/domain/exceptions/skill-main-file-missing.error';
import type { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { SKILL_FILE } from '@work/application/contracts/run-spec.contract';

export const SKILLS = 'skills';

export const skillAt = (key: string): string => `${SKILLS}/${key}`;

export const SkillProblems = {
  invalid(key: string, error: InvalidSkillError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: skillAt(key),
      at: FieldPath.of(
        error instanceof SkillKeyReservedError
          ? [error.field]
          : error instanceof SkillMainFileMissingError
            ? ['files']
            : ['files', SKILL_FILE],
      ),
      reason: error.because,
    });
  },

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
