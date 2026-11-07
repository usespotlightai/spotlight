import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ProposalAlreadyOpenedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(chatId: string, position: number) {
    super(`Proposal ${position} of chat ${chatId} is already a task.`);
    this.name = 'ProposalAlreadyOpenedError';
  }
}
