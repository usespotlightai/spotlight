import type { Holdings } from '@identity/domain/value-objects/holdings.vo';

export class WorkspaceInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(slug: string, holdings: Holdings) {
    super(
      `The ${slug} workspace still holds ${
        holdings.isEmpty ? 'a team' : holdings.held.join(', ')
      }; delete those first`,
    );
    this.name = 'WorkspaceInUseError';
  }
}
