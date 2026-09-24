import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';

export class SkillKeyReservedError extends InvalidSkillError {
  readonly field = 'key';

  constructor(skill: string) {
    super(
      skill,
      'cannot start spotlight-, which is reserved for the skills Spotlight ships; pick a key without it',
    );
    this.name = 'SkillKeyReservedError';
  }
}
