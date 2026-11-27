import { isReservedSecretName } from '@secrets/domain/value-objects/reserved-secret-name';
import type { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import type { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';

// How a secret reaches runs. A run receives it only when something uses it, and egress sends it to its hosts only when a runner of the workspace has egress.
export class SecretReach {
  private constructor(
    readonly usedByRuns: boolean,
    readonly deliverable: boolean,
  ) {}

  static of(
    secret: {
      readonly name: string;
      readonly uses: SecretUses;
      readonly bindings: SecretBindings;
    },
    workspace: {
      readonly harnessKeys: readonly string[];
      readonly egressRunners: boolean;
    },
  ): SecretReach {
    return new SecretReach(
      // A harness profile or integration names it, a host gives it to its harness as a harness key, or it is one of Spotlight's own secrets.
      !secret.uses.isEmpty ||
        isReservedSecretName(secret.name) ||
        workspace.harnessKeys.includes(secret.name),
      // A secret bound to no host needs no egress.
      secret.bindings.isEmpty || workspace.egressRunners,
    );
  }
}
