import type { HarnessProfileKeyFixedError } from '@configuration/domain/exceptions/harness-profile-key-fixed.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const HARNESS_PROFILES = 'harness-profiles';

export const profileAt = (key: string): string => `${HARNESS_PROFILES}/${key}`;

export const HarnessProfileProblems = {
  keyFixed(error: HarnessProfileKeyFixedError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: profileAt(error.key),
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },
};
