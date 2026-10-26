export class TrustsNeedAnAdminError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor() {
    super('Only a workspace owner or admin can create OIDC trusts.');
    this.name = 'TrustsNeedAnAdminError';
  }
}
