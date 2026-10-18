export class InvalidToolInputError extends Error {
  readonly kind = 'invalid' as const;

  constructor(tool: string, because: string) {
    super(`${tool} ${because}`);
    this.name = 'InvalidToolInputError';
  }
}
