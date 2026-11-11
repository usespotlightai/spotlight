import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidWorkspaceSlugError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Workspace URL ${because}.`);
    this.name = 'InvalidWorkspaceSlugError';
  }
}
