import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

export class WorkspaceId {
  // Brands the class: without a private member TypeScript compares ids by
  // shape, and every kind of id becomes interchangeable.
  private readonly kind = 'workspace';

  private constructor(readonly value: string) {}

  static of(value: string): WorkspaceId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('workspace');
    }
    return new WorkspaceId(value);
  }

  equals(other: WorkspaceId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
