import type { TeamHoldings } from '@identity/domain/value-objects/team-holdings.vo';

export class TeamInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string, holdings: TeamHoldings) {
    super(
      `The ${key} team still holds ${holdings.held.join(', ')}; delete those first`,
    );
    this.name = 'TeamInUseError';
  }
}
