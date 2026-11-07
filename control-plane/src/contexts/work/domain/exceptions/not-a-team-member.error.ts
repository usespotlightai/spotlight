import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotATeamMemberError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor() {
    super('Assignee is not a member of this team.');
    this.name = 'NotATeamMemberError';
  }
}
