export class SecretNotGrantedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(secretName: string, toward: string) {
    super(`This run was not granted the ${secretName} secret toward ${toward}`);
    this.name = 'SecretNotGrantedError';
  }
}
