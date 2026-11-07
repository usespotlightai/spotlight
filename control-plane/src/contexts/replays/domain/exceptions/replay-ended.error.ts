import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReplayEndedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(replayId: string) {
    super(`Replay ${replayId} has already ended or been stopped.`);
    this.name = 'ReplayEndedError';
  }
}
