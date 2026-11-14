import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidInferenceEndpointError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`Inference endpoint ${field} ${because}.`);
    this.name = 'InvalidInferenceEndpointError';
  }
}
