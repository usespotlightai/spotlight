export class InvalidToolUseError extends Error {
  readonly kind = 'invalid' as const;

  constructor(rule: string) {
    super(`A run's tool use ${rule}`);
    this.name = 'InvalidToolUseError';
  }
}
