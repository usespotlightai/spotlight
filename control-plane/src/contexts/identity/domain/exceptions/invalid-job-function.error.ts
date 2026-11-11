import { JOB_FUNCTIONS } from '@identity/domain/value-objects/job-function.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidJobFunctionError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(raw: string) {
    super(
      `Job function ${raw} does not exist. Valid job functions: ${JOB_FUNCTIONS.join(', ')}`,
    );
    this.name = 'InvalidJobFunctionError';
  }
}
