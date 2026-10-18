export class SkillDefinitionVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(
      `Skill ${key} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'SkillDefinitionVersionConflictError';
  }
}
