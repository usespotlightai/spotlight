import { JOB_FUNCTIONS } from '@identity/domain/value-objects/job-function.vo';

export class InvalidJobFunctionError extends Error {
  readonly kind = 'invalid' as const;

  constructor(raw: string) {
    super(
      `Job function ${raw} does not exist. Valid job functions: ${JOB_FUNCTIONS.join(', ')}`,
    );
    this.name = 'InvalidJobFunctionError';
  }
}
