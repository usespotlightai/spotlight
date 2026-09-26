import type { HookKeyFixedError } from '@integrations/domain/exceptions/hook-key-fixed.error';
import type { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
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

  keyFixed(key: string, error: HookKeyFixedError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: hookAt(key),
      at: FieldPath.of(['key']),
      reason: error.because,
    });
  },
};
