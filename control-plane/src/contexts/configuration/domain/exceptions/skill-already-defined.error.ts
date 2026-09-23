export class SkillAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`The team already has a ${key} skill`);
    this.name = 'SkillAlreadyDefinedError';
  }
}
