export class InvalidSkillError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    skill: string,
    readonly because: string,
  ) {
    super(`Skill ${skill} ${because}.`);
    this.name = 'InvalidSkillError';
  }
}
