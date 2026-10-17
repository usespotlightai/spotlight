import type { Dependents } from '@identity/domain/value-objects/dependents.vo';

export class TeamInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string, dependents: Dependents) {
    super(
      `Team ${key} is not empty. It still has: ${dependents.names.join(', ')}`,
    );
    this.name = 'TeamInUseError';
  }
}
