import type { Holdings } from '@identity/domain/value-objects/holdings.vo';

export class WorkspaceInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(slug: string, holdings: Holdings) {
    super(
      holdings.isEmpty
        ? `Workspace ${slug} still has recent changes settling. Please try again shortly.`
        : `Workspace ${slug} is not empty. Still holds: ${holdings.held.join(', ')}`,
    );
    this.name = 'WorkspaceInUseError';
  }
}
