import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnsafeBranchNameError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(branch: string) {
    super(
      `The default branch ${branch} contains * or :, so an OIDC trust cannot name it exactly. Rename the branch, then set up again.`,
    );
    this.name = 'UnsafeBranchNameError';
  }
}
