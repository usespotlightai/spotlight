import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SandboxVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(sandboxId: string) {
    super(
      `Sandbox ${sandboxId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'SandboxVersionConflictError';
  }
}
