import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ArrivalLedgerVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(workspaceId: string) {
    super(
      `The arrival ledger of workspace ${workspaceId} changed while Spotlight read it.`,
    );
    this.name = 'ArrivalLedgerVersionConflictError';
  }
}
