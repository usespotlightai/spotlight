import { SecretTargetConflictError } from '@secrets/domain/exceptions/secret-target-conflict.error';
import type { SecretBinding } from '@secrets/domain/value-objects/secret-binding.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

interface Claim {
  readonly secret: SecretName;
  readonly binding: SecretBinding;
}

export class SecretTargets {
  private constructor(private readonly claims: readonly Claim[]) {}

  static none(): SecretTargets {
    return new SecretTargets([]);
  }

  claim(secret: SecretName, bindings: readonly SecretBinding[]): SecretTargets {
    for (const binding of bindings) {
      const taken = this.claims.find(
        (each) =>
          !each.secret.equals(secret) &&
          each.binding.host.equals(binding.host) &&
          each.binding.target.equals(binding.target),
      );

      if (taken) {
        throw new SecretTargetConflictError(
          secret.value,
          taken.secret.value,
          binding.target.written,
        );
      }
    }

    return new SecretTargets([
      ...this.claims,
      ...bindings.map((binding) => ({ secret, binding })),
    ]);
  }
}
