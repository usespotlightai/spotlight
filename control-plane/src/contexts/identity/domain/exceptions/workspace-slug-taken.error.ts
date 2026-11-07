import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkspaceSlugTakenError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(readonly slug: string) {
    super(`Workspace URL ${slug} is already taken. Please choose another.`);
    this.name = 'WorkspaceSlugTakenError';
  }
}
