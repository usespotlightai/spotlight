export class UnopenableVaultError extends Error {
  readonly violation = 'conflict' as const;

  constructor(because: string) {
    super(`This configuration ${because}`);
    this.name = 'UnopenableVaultError';
  }
}
