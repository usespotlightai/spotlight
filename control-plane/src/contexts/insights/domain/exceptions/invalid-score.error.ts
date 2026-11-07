import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

const SUBJECTS = {
  score: 'Score',
  reason: 'Judge reason',
} as const;

export class InvalidScoreError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string, subject: keyof typeof SUBJECTS = 'score') {
    super(`${SUBJECTS[subject]} ${reason}.`);
    this.name = 'InvalidScoreError';
  }
}
