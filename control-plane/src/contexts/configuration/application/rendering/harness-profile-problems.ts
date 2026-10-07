import type { HarnessProfileKeyFixedError } from '@configuration/domain/exceptions/harness-profile-key-fixed.error';
import type { WornSecret } from '@configuration/domain/value-objects/profile-settings.vo';
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

  unheld(key: string, unheld: readonly WornSecret[]): ConfigurationProblem[] {
    return unheld.map((worn) =>
      ConfigurationProblem.of({
        path: profileAt(key),
        at: FieldPath.of([...worn.at]),
        reason: `uses secret ${worn.secret.value} that the workspace does not hold`,
      }),
    );
  },
};
