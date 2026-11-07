import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class CandidateVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(candidateId: string) {
    super(
      `Candidate ${candidateId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'CandidateVersionConflictError';
  }
}
