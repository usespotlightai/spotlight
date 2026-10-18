import type { StationUses } from '@configuration/domain/value-objects/station-uses.vo';

export class HarnessProfileInUseError extends Error {
  readonly kind = 'conflict' as const;

  constructor(key: string, uses: StationUses) {
    super(
      `Harness profile ${key} is in use. Stations using it: ${uses.stations}`,
    );
    this.name = 'HarnessProfileInUseError';
  }
}
