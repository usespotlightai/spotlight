import type { FactoryId } from '@domain/value-objects/factory-id.vo';

export class Factory {
  private constructor(readonly id: FactoryId) {}

  static create(input: { id: FactoryId }): Factory {
    return new Factory(input.id);
  }

  equals(other: Factory): boolean {
    return this.id.equals(other.id);
  }
}
