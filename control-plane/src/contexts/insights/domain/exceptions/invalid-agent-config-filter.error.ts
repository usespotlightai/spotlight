export class InvalidAgentConfigFilterError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Agent config filter ${reason}.`);
    this.name = 'InvalidAgentConfigFilterError';
  }
}
