export class SkillDefinitionMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`The ${key} skill was defined again while this was`);
    this.name = 'SkillDefinitionMovedOnError';
  }
}
