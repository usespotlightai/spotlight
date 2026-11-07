import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReplayVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(replayId: string) {
    super(
      `Replay ${replayId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ReplayVersionConflictError';
  }
}
