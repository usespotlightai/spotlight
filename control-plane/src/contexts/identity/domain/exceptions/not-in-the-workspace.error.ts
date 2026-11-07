import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotInTheWorkspaceError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor() {
    super(
      'This person is not a member of this workspace. Please invite them first.',
    );
    this.name = 'NotInTheWorkspaceError';
  }
}
