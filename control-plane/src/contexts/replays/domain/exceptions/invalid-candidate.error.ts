import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidCandidateError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`Candidate ${reason}.`);
    this.name = 'InvalidCandidateError';
  }
}
