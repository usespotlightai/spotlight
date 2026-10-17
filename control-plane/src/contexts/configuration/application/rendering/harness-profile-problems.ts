import type { HarnessProfileKeyFixedError } from '@configuration/domain/exceptions/harness-profile-key-fixed.error';
import type { SecretReferenceAt } from '@configuration/domain/value-objects/secret-reference-at.vo';
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

  missing(
    key: string,
    missing: readonly SecretReferenceAt[],
  ): ConfigurationProblem[] {
    return missing.map((reference) =>
      ConfigurationProblem.of({
        path: profileAt(key),
        at: reference.path,
        reason: `uses secret ${reference.name} that the workspace does not have`,
      }),
    );
  },
};
