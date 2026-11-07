import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export class UnsearchableRequestError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly problems: readonly ConfigurationProblem[]) {
    super('The requested candidate changes what a search may not change');
    this.name = 'UnsearchableRequestError';
  }
}
