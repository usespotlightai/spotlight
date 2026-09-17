export class NotYoursToRevealVaultKeyError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor() {
    super('Only an owner or an admin may reveal the vault key');
    this.name = 'NotYoursToRevealVaultKeyError';
  }
}
