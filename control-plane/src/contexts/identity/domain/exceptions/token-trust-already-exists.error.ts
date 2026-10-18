export class TokenTrustAlreadyExistsError extends Error {
  readonly kind = 'conflict' as const;

  constructor(readonly key: string) {
    super(
      `A token trust with key ${key} already exists. Please choose another key.`,
    );
    this.name = 'TokenTrustAlreadyExistsError';
  }
}
