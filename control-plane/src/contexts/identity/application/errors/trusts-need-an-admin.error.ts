import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class TrustsNeedAnAdminError extends ApplicationError {
  readonly kind = 'not-allowed' as const;

  constructor() {
    super('Only a workspace owner or admin can create OIDC trusts.');
    this.name = 'TrustsNeedAnAdminError';
  }
}
