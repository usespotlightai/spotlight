import type { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class PushAlreadyWaitingError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(head: CommitSha) {
    super(`A diff of push ${head.value} already waits for a runner.`);
    this.name = 'PushAlreadyWaitingError';
  }
}
