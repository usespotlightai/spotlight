import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkspaceTokenAlreadyIssuedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(readonly tokenName: string) {
    super(
      `A token named ${tokenName} already exists. Please choose another name.`,
    );
    this.name = 'WorkspaceTokenAlreadyIssuedError';
  }
}
