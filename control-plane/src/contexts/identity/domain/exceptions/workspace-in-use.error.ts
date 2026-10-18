import type { Dependents } from '@identity/domain/value-objects/dependents.vo';

export class WorkspaceInUseError extends Error {
  readonly kind = 'conflict' as const;

  constructor(slug: string, dependents: Dependents) {
    super(
      dependents.isEmpty
        ? `Workspace ${slug} still has recent changes in progress. Please try again shortly.`
        : `Workspace ${slug} is not empty. It still has: ${dependents.names.join(', ')}`,
    );
    this.name = 'WorkspaceInUseError';
  }
}
