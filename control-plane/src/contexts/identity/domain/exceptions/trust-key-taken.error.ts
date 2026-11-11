import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TrustKeyTakenError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string, subject: string) {
    super(
      `The OIDC trust ${key} already admits another workload (${subject}). Rename or delete that trust, then set up again.`,
    );
    this.name = 'TrustKeyTakenError';
  }
}
