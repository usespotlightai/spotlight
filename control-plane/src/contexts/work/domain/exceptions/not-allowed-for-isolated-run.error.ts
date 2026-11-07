import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotAllowedForIsolatedRunError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(`This run may not ${what}: it acts on nothing beyond its own result`);
    this.name = 'NotAllowedForIsolatedRunError';
  }
}
