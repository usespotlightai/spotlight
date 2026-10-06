import type { Holdings } from '@identity/domain/value-objects/holdings.vo';

export class TeamInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string, holdings: Holdings) {
    super(`Team ${key} is not empty. Still holds: ${holdings.held.join(', ')}`);
    this.name = 'TeamInUseError';
  }
}
