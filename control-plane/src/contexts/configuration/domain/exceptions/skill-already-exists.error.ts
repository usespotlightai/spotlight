import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SkillAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(`Skill ${key} already exists. Please choose another key.`);
    this.name = 'SkillAlreadyExistsError';
  }
}
