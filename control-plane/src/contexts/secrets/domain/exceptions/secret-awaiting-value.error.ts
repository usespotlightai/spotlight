import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SecretAwaitingValueError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(readonly secretName: string) {
    super(
      `Secret ${secretName} has no value. Set it on the Secrets settings page, with spotlight secret set ${secretName}, or with value_wo and value_wo_version in Terraform.`,
    );
    this.name = 'SecretAwaitingValueError';
  }
}
