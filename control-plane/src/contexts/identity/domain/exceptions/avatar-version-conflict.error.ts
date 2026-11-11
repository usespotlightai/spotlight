import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class AvatarVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(owner: string) {
    super(
      `The avatar of ${owner} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'AvatarVersionConflictError';
  }
}
