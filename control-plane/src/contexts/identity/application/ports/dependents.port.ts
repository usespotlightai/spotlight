import type { ResourceType } from '@shared-kernel/domain/value-objects/configuration-change.vo';

export interface Dependent {
  readonly kind: ResourceType;
  readonly key: string | null;
}

export interface DependentSource<Id> {
  dependentsOf(id: Id): Promise<readonly Dependent[]>;
}

export interface DependentsPort<Id> {
  register(source: DependentSource<Id>): void;

  of(id: Id): Promise<readonly Dependent[]>;
}
