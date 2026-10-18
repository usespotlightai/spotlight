export class InvalidSkillError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    skill: string,
    readonly because: string,
  ) {
    super(`Skill ${skill} ${because}.`);
    this.name = 'InvalidSkillError';
  }
}
