import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class WorkspaceTokenTrustId {
  private readonly kind = 'workspace-token-trust';

  private constructor(readonly value: string) {}

  static of(value: string): WorkspaceTokenTrustId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('workspace token trust');
    }
    return new WorkspaceTokenTrustId(value);
  }

  equals(other: WorkspaceTokenTrustId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
