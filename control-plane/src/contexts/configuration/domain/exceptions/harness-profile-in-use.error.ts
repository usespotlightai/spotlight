import type { StationUses } from '@configuration/domain/value-objects/station-uses.vo';

export class HarnessProfileInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string, uses: StationUses) {
    super(
      `The ${key} harness profile is named by ${uses.stations}; take it off those stations first`,
    );
    this.name = 'HarnessProfileInUseError';
  }
}
