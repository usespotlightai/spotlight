import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TeamOutsideWorkspaceError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(teamId: string) {
    super(`Team ${teamId} is not in this workspace.`);
    this.name = 'TeamOutsideWorkspaceError';
  }
}
