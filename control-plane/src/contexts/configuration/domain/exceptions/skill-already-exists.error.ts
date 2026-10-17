export class SkillAlreadyExistsError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`Skill ${key} already exists. Please choose another key.`);
    this.name = 'SkillAlreadyExistsError';
  }
}
