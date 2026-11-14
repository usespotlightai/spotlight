import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidDefaultAssigneeError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Default assignee ${because}.`);
    this.name = 'InvalidDefaultAssigneeError';
  }
}
