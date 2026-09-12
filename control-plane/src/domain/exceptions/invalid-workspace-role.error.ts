import { WORKSPACE_ROLES } from '@domain/value-objects/workspace-role.vo';

export class InvalidWorkspaceRoleError extends Error {
  readonly violation = 'invalid' as const;

  constructor(raw: string) {
    super(
      `There is no such role as ${raw}. A person is one of: ${WORKSPACE_ROLES.join(', ')}`,
    );
    this.name = 'InvalidWorkspaceRoleError';
  }
}
