import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunWorkspaceKeyConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(
      `Workspace ${key} belongs to work Spotlight orders. A run you order can only carry on its own workspaces.`,
    );
    this.name = 'RunWorkspaceKeyConflictError';
  }
}
