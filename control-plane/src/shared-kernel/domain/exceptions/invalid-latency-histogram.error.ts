import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidLatencyHistogramError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Latency histogram ${reason}.`);
    this.name = 'InvalidLatencyHistogramError';
  }
}
