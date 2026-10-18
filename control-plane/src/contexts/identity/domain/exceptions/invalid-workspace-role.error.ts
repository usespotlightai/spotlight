import { WORKSPACE_ROLES } from '@identity/domain/value-objects/workspace-role.vo';

export class InvalidWorkspaceRoleError extends Error {
  readonly kind = 'invalid' as const;

  constructor(raw: string) {
    super(
      `Role ${raw} does not exist. Valid roles: ${WORKSPACE_ROLES.join(', ')}`,
    );
    this.name = 'InvalidWorkspaceRoleError';
  }
}
