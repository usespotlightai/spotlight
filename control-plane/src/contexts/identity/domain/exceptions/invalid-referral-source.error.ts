import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidReferralSourceError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(maxLength: number) {
    super(`Referral source must be at most ${maxLength} characters.`);
    this.name = 'InvalidReferralSourceError';
  }
}
