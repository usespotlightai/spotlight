import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';

export class SkillKeyReservedError extends InvalidSkillError {
  readonly field = 'key';

  constructor(skill: string) {
    super(
      skill,
      'cannot start with spotlight-. That prefix is reserved for built-in skills',
    );
    this.name = 'SkillKeyReservedError';
  }
}
