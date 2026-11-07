import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SkillDefinitionVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(
      `Skill ${key} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'SkillDefinitionVersionConflictError';
  }
}
