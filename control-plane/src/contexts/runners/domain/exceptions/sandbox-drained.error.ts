import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SandboxDrainedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(`The sandbox of ${key} drained each time an editor tried to hold it`);
    this.name = 'SandboxDrainedError';
  }
}
