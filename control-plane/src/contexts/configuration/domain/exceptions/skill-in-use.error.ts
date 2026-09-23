import type { SkillUses } from '@configuration/domain/value-objects/skill-uses.vo';

export class SkillInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string, uses: SkillUses) {
    super(
      `The ${key} skill is given by ${uses.uses
        .map((each) => each.by)
        .join(', ')}; take it off those stations first`,
    );
    this.name = 'SkillInUseError';
  }
}
