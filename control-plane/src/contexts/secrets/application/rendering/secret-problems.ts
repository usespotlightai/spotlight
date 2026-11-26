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

  unreachable(): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: SECRET,
      at: FieldPath.of(['bindings']),
      reason:
        'are never injected: no runner pool of the workspace has egress. Add a pool that hosts pull from, or set provision.egress on a push pool',
      severity: 'warning',
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
