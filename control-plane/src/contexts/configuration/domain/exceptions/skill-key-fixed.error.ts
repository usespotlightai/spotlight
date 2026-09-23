export class SkillKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'key';

  constructor(
    readonly key: string,
    readonly because: string,
  ) {
    super(`The ${key} skill ${because}`);
    this.name = 'SkillKeyFixedError';
  }
}
