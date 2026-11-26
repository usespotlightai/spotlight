import type { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import type { SecretReach } from '@secrets/domain/value-objects/secret-reach.vo';
import type { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const SECRET = 'secret';

const UNUSED =
  'no harness profile or integration uses this secret, so no run receives it. Name it in a harness profile or an integration';

const UNDELIVERABLE =
  'are never injected: no runner pool of the workspace has egress. Add a pool that hosts pull from, or set provision.egress on a push pool';

const atBindings = (reason: string): ConfigurationProblem =>
  ConfigurationProblem.of({
    path: SECRET,
    at: FieldPath.of(['bindings']),
    reason,
    severity: 'warning',
  });

export const SecretProblems = {
  invalid(error: InvalidSecretError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: SECRET,
      at: error.field,
      reason: error.because,
    });
  },

  // One warning for each way the secret fails to reach runs.
  reach(reach: SecretReach): readonly ConfigurationProblem[] {
    return [
      ...(reach.usedByRuns ? [] : [atBindings(UNUSED)]),
      ...(reach.deliverable ? [] : [atBindings(UNDELIVERABLE)]),
    ];
  },

  immutableField(error: ImmutableFieldError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: SECRET,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },
};
