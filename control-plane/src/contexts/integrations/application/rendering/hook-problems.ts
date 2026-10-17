import type { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import type { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const HOOKS = 'hooks';

export const hookAt = (key: string): string => `${HOOKS}/${key}`;

export const HookProblems = {
  invalid(key: string, error: InvalidHookError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: hookAt(key),
      at: error.at,
      reason: error.because,
    });
  },

  immutableField(
    key: string,
    error: ImmutableFieldError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: hookAt(key),
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },
};
