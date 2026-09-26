import type { Holdings } from '@identity/domain/value-objects/holdings.vo';

export class WorkspaceInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(slug: string, holdings: Holdings) {
    super(
      holdings.isEmpty
        ? `The ${slug} workspace still holds something made or revoked in it a moment ago; try again shortly`
        : `The ${slug} workspace still holds ${holdings.held.join(', ')}; delete those first`,
    );
    this.name = 'WorkspaceInUseError';
  }
}
