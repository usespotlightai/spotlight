import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkspaceVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(slug: string) {
    super(
      `Workspace ${slug} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'WorkspaceVersionConflictError';
  }
}
