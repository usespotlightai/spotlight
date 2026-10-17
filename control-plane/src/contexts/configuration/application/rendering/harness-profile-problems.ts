import type { SecretReferenceAt } from '@configuration/domain/value-objects/secret-reference-at.vo';
import type { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const HARNESS_PROFILES = 'harness-profiles';

export const profileAt = (key: string): string => `${HARNESS_PROFILES}/${key}`;

export const HarnessProfileProblems = {
  immutableField(
    key: string,
    error: ImmutableFieldError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: profileAt(key),
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
