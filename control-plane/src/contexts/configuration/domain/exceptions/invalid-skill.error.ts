export class InvalidSkillError extends Error {
  readonly violation = 'invalid' as const;

  constructor(skill: string, because: string) {
    super(`The ${skill} skill ${because}`);
    this.name = 'InvalidSkillError';
  }
}
