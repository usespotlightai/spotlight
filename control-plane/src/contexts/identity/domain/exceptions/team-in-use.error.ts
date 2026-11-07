import type { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TeamInUseError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string, dependents: Dependents) {
    super(
      `Team ${key} is not empty. It still has: ${dependents.described.join(', ')}`,
    );
    this.name = 'TeamInUseError';
  }
}
