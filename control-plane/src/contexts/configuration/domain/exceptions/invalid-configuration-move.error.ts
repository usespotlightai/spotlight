export class InvalidConfigurationMoveError extends Error {
  readonly violation = 'invalid' as const;

  constructor(because: string) {
    super(`This team ${because}`);
    this.name = 'InvalidConfigurationMoveError';
  }
}
