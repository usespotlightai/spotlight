export class TokenTrustAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly key: string) {
    super(
      `A token trust with key ${key} already exists. Please choose another key.`,
    );
    this.name = 'TokenTrustAlreadyDefinedError';
  }
}
