import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class HookAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(
      `A hook named ${key} already exists in this team. Please choose another name.`,
    );
    this.name = 'HookAlreadyExistsError';
  }
}
