import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TeamMembershipRequiredError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor() {
    super(
      'You are not a member of this team. Only team members and workspace admins can review its changes.',
    );
    this.name = 'TeamMembershipRequiredError';
  }
}
