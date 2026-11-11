import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnplaceableHappeningError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(happening: string) {
    super(
      `Reading a ${happening}: it names neither a branch nor anything this line knows a task by`,
    );
    this.name = 'UnplaceableHappeningError';
  }
}
