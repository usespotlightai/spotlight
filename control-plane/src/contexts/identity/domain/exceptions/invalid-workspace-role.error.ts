import { WORKSPACE_ROLES } from '@identity/domain/value-objects/workspace-role.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidWorkspaceRoleError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(raw: string) {
    super(
      `Role ${raw} does not exist. Valid roles: ${WORKSPACE_ROLES.join(', ')}`,
    );
    this.name = 'InvalidWorkspaceRoleError';
  }
}
