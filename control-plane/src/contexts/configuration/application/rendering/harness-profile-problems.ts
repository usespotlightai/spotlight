import type { HarnessIncompatibility } from '@configuration/domain/value-objects/harness-compatibility.vo';
import type { SecretReference } from '@configuration/domain/value-objects/secret-reference.vo';
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

  incompatible(
    key: string,
    incompatibilities: readonly HarnessIncompatibility[],
  ): ConfigurationProblem[] {
    return incompatibilities.map((each) =>
      ConfigurationProblem.of({
        path: profileAt(key),
        at: each.at,
        reason: each.reason,
        severity: 'error',
      }),
    );
  },

  missing(
    key: string,
    missing: readonly SecretReference[],
  ): ConfigurationProblem[] {
    return missing.map((reference) =>
      ConfigurationProblem.of({
        path: profileAt(key),
        at: reference.path,
        reason: `uses secret ${reference.name.value} that the workspace does not have`,
      }),
    );
  },

  sandboxNotAllowed(
    key: string,
    refused: readonly SecretReference[],
  ): ConfigurationProblem[] {
    return refused.map((reference) =>
      ConfigurationProblem.of({
        path: profileAt(key),
        at: reference.path,
        reason: `names secret ${reference.name.value}, which does not allow its value in a sandbox. Set sandbox = "env" on the secret`,
      }),
    );
  },

  awaitingValue(
    key: string,
    awaiting: readonly SecretReference[],
  ): ConfigurationProblem[] {
    return awaiting.map((reference) =>
      ConfigurationProblem.of({
        path: profileAt(key),
        at: reference.path,
        reason: `names secret ${reference.name.value}, which has no value. Runs with this profile do not start until a person sets it`,
        severity: 'warning',
      }),
    );
  },
};
