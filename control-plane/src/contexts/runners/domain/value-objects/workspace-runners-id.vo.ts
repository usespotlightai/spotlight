import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class WorkspaceRunnersId {
  private readonly kind = 'workspace-runners';

  private constructor(readonly value: string) {}

  static of(value: string): WorkspaceRunnersId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('workspace runners');
    }

    return new WorkspaceRunnersId(value);
  }

  equals(other: WorkspaceRunnersId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
