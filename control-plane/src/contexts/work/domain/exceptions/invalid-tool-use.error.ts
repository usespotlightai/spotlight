export class InvalidToolUseError extends Error {
  readonly violation = 'invalid' as const;

  constructor(rule: string) {
    super(`A run's tool use ${rule}`);
    this.name = 'InvalidToolUseError';
  }
}
