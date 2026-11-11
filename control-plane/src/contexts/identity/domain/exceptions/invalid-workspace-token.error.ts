import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidWorkspaceTokenError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`Workspace token ${field} ${because}.`);
    this.name = 'InvalidWorkspaceTokenError';
  }
}
