export class InvalidSkillError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    skill: string,
    readonly because: string,
  ) {
    super(`The ${skill} skill ${because}`);
    this.name = 'InvalidSkillError';
  }
}
