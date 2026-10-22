export class OidcTrustAlreadyExistsError extends Error {
  readonly kind = 'conflict' as const;

  constructor(readonly key: string) {
    super(
      `An OIDC trust with key ${key} already exists. Please choose another key.`,
    );
    this.name = 'OidcTrustAlreadyExistsError';
  }
}
