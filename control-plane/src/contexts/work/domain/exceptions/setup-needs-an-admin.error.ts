import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SetupNeedsAnAdminError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor() {
    super(
      'Only a workspace owner or admin can set up configuration as code. The setup creates the OIDC trusts that GitHub Actions signs in with.',
    );
    this.name = 'SetupNeedsAnAdminError';
  }
}
