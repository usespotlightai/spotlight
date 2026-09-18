import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class WorkspaceId {
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
