import type { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkspaceInUseError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(slug: string, dependents: Dependents) {
    super(
      dependents.isEmpty
        ? `Workspace ${slug} still has recent changes in progress. Please try again shortly.`
        : `Workspace ${slug} is not empty. It still has: ${dependents.described.join(', ')}`,
    );
    this.name = 'WorkspaceInUseError';
  }
}
