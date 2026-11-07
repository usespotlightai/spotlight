import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InferredOutputSchemaVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(tool: string) {
    super(
      `Another call inferred what ${tool} answers at the same time. Please try again.`,
    );
    this.name = 'InferredOutputSchemaVersionConflictError';
  }
}
