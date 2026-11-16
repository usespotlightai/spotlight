import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InferenceEndpointVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Inference endpoint ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'InferenceEndpointVersionConflictError';
  }
}
