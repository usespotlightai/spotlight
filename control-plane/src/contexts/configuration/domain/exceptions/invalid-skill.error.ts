import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidSkillError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    skill: string,
    readonly because: string,
  ) {
    super(`Skill ${skill} ${because}.`);
    this.name = 'InvalidSkillError';
  }
}
