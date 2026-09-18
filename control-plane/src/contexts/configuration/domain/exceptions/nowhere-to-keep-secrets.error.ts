export class NowhereToKeepSecretsError extends Error {
  readonly violation = 'conflict' as const;

  constructor() {
    super(
      'There is nowhere to keep secrets yet: choose the configuration repository first',
    );
    this.name = 'NowhereToKeepSecretsError';
  }
}
