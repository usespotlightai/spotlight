import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidWorkspaceRoleError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(raw: string, valid: readonly string[]) {
    super(`Role ${raw} does not exist. Valid roles: ${valid.join(', ')}`);
    this.name = 'InvalidWorkspaceRoleError';
  }
}
