import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidApprovalAnswerError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(because: string) {
    super(because);
    this.name = 'InvalidApprovalAnswerError';
  }
}
