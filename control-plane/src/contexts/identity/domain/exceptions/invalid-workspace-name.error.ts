import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidWorkspaceNameError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Workspace name ${because}.`);
    this.name = 'InvalidWorkspaceNameError';
  }
}
