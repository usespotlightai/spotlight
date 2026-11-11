import type { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TerraformStateLockedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(
    name: string,
    readonly holder: StateLock,
  ) {
    super(
      `Terraform state ${name} is locked by ${holder.id}. Wait until that run ends, or release the lock with terraform force-unlock ${holder.id}.`,
    );
    this.name = 'TerraformStateLockedError';
  }
}
