import type { StationUses } from '@configuration/domain/value-objects/station-uses.vo';

export class SkillInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string, uses: StationUses) {
    super(
      `The ${key} skill is given by ${uses.stations}; take it off those stations first`,
    );
    this.name = 'SkillInUseError';
  }
}
