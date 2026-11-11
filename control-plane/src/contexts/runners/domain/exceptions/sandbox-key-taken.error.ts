import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SandboxKeyTakenError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(sandboxId: string) {
    super(
      `Sandbox ${sandboxId} cannot take its key. Another open sandbox has that key.`,
    );
    this.name = 'SandboxKeyTakenError';
  }
}
