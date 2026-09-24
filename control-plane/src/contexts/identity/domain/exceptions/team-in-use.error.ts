import type { Holdings } from '@identity/domain/value-objects/holdings.vo';

export class TeamInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string, holdings: Holdings) {
    super(
      `The ${key} team still holds ${holdings.held.join(', ')}; delete those first`,
    );
    this.name = 'TeamInUseError';
  }
}
