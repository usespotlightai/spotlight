import type { ResourceType } from '@shared-kernel/domain/value-objects/configuration-change.vo';

type DependentKind = ResourceType;

export interface Dependent {
  readonly kind: DependentKind;
  readonly key: string | null;
}

const OWN_LABELS: Readonly<Record<string, string>> = {
  'workspace-token': 'token',
  'oidc-trust': 'OIDC trust',
  'issued-tokens': 'tokens issued by',
};

const labelOf = (kind: DependentKind): string =>
  OWN_LABELS[kind] ?? kind.replaceAll('-', ' ');

const described = (dependent: Dependent): string =>
  dependent.key === null
    ? labelOf(dependent.kind)
    : `${labelOf(dependent.kind)} ${dependent.key}`;

const inOrder = (one: string, other: string): number =>
  one === other ? 0 : one < other ? -1 : 1;

export class Dependents {
  private constructor(readonly all: readonly Dependent[]) {}

  static of(all: readonly Dependent[]): Dependents {
    return new Dependents(
      [...all].sort((one, other) => inOrder(described(one), described(other))),
    );
  }

  static none(): Dependents {
    return new Dependents([]);
  }

  and(other: Dependents): Dependents {
    return Dependents.of([...this.all, ...other.all]);
  }

  get isEmpty(): boolean {
    return this.all.length === 0;
  }

  get described(): readonly string[] {
    return this.all.map(described);
  }
}
