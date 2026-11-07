import type { ResourceType } from '@shared-kernel/domain/value-objects/configuration-change.vo';

interface SecretUse {
  readonly kind: ResourceType;
  readonly key: string;
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

  get described(): readonly string[] {
    return this.by.map(described);
  }
}
