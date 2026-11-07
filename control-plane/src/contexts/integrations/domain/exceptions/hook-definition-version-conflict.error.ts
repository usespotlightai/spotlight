import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class HookDefinitionVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(`Hook ${key} changed while saving. Please try again.`);
    this.name = 'HookDefinitionVersionConflictError';
  }
}
