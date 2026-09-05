import { InvalidWorkspaceNameError } from '@domain/exceptions/invalid-workspace-name.error';

const MAX_LENGTH = 100;

export class WorkspaceName {
  private readonly kind = 'workspace-name' as const;

  private constructor(readonly value: string) {}

  static of(raw: string): WorkspaceName {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidWorkspaceNameError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidWorkspaceNameError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new WorkspaceName(trimmed);
  }

  equals(other: WorkspaceName): boolean {
    return this.value === other.value && this.kind === other.kind;
  }
}
