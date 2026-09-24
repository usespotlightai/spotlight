import type { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import type { SecretNameFixedError } from '@secrets/domain/exceptions/secret-name-fixed.error';
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

  nameFixed(error: SecretNameFixedError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: SECRET,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },
};
