import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

const BECAUSE = {
  ordered: 'The assist session has not queued its run yet.',
  submitted: 'The assist session accepted a result already.',
  failed: 'The assist session failed and takes no result.',
} as const;

export class AssistResultNotAcceptedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(readonly because: keyof typeof BECAUSE) {
    super(BECAUSE[because]);
    this.name = 'AssistResultNotAcceptedError';
  }
}
