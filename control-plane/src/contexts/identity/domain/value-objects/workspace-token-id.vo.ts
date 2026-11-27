import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class WorkspaceTokenId {
  private readonly kind = 'workspace-token';

  private constructor(readonly value: string) {}

  static of(value: string): WorkspaceTokenId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('workspace token');
    }
    return new WorkspaceTokenId(value);
  }

  equals(other: WorkspaceTokenId): boolean {
    return other instanceof WorkspaceTokenId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
