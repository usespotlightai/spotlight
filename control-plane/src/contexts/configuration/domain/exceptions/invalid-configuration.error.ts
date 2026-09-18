export class InvalidConfigurationError extends Error {
  readonly violation = 'invalid' as const;

  constructor(because: string) {
    super(`This configuration ${because}`);
    this.name = 'InvalidConfigurationError';
  }
}
