import type { StationUses } from '@configuration/domain/value-objects/station-uses.vo';

export class SkillInUseError extends Error {
  readonly kind = 'conflict' as const;

  constructor(key: string, uses: StationUses) {
    super(`Skill ${key} is in use. Stations using it: ${uses.stations}`);
    this.name = 'SkillInUseError';
  }
}
