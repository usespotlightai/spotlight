import type { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import type { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const SECRET = 'secret';

export const SecretProblems = {
  invalid(error: InvalidSecretError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: SECRET,
      at: error.field,
      reason: error.because,
    });
  },

  immutableField(error: ImmutableFieldError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: SECRET,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },
};
