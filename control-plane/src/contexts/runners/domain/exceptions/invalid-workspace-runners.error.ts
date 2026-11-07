import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidWorkspaceRunnersError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: 'trusts' | 'pools',
    readonly at: number,
    readonly because: string,
  ) {
    super(`Workspace runners ${field}[${at}] ${because}.`);
    this.name = 'InvalidWorkspaceRunnersError';
  }
}
