import type { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';

export class HarnessProfileInUseError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string, uses: StationUses<ProfileKey>) {
    super(
      `Harness profile ${key} is in use. Stations using it: ${uses.stations}`,
    );
    this.name = 'HarnessProfileInUseError';
  }
}
