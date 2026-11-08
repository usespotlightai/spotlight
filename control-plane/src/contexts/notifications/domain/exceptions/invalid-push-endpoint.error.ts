import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidPushEndpointError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor() {
    super('The push endpoint is not an HTTPS address of a known push service.');
    this.name = 'InvalidPushEndpointError';
  }
}
