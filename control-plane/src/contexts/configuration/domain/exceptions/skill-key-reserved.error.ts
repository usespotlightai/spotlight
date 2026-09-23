import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';

export class SkillKeyReservedError extends InvalidSkillError {
  readonly field = 'key';

  constructor(skill: string) {
    super(
      skill,
      "is named as Spotlight names its own, and a name starting spotlight- is Spotlight's own: name it without spotlight-",
    );
    this.name = 'SkillKeyReservedError';
  }
}
