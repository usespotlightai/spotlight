import { isReservedSecretName } from '@secrets/domain/value-objects/reserved-secret-name';
import type { ResourceType } from '@shared-kernel/domain/value-objects/configuration-change.vo';

interface SecretUse {
  readonly kind: ResourceType;
  readonly key: string;
  readonly exposes: boolean;
}

const described = (use: SecretUse): string =>
  `${use.kind.replaceAll('-', ' ')} ${use.key}`;

export class SecretUses {
  private constructor(readonly by: readonly SecretUse[]) {}

  static of(by: readonly SecretUse[]): SecretUses {
    return new SecretUses(
      [...by].sort((one, other) =>
        described(one).localeCompare(described(other)),
      ),
    );
  }

  static none(): SecretUses {
    return new SecretUses([]);
  }

  get isEmpty(): boolean {
    return this.by.length === 0;
  }

  // A run receives a secret only through a harness profile or integration that names it, as a harness key that a host gives its harness, or as one of Spotlight's own secrets.
  reachesRuns(secret: string, harnessKeys: readonly string[]): boolean {
    return (
      !this.isEmpty ||
      isReservedSecretName(secret) ||
      harnessKeys.includes(secret)
    );
  }

  get exposures(): SecretUses {
    return new SecretUses(this.by.filter((each) => each.exposes));
  }

  get described(): readonly string[] {
    return this.by.map(described);
  }
}
