export class SecretNotGrantedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(secretName: string, toward: string) {
    super(`Run has no grant for secret ${secretName}. Host: ${toward}`);
    this.name = 'SecretNotGrantedError';
  }
}
