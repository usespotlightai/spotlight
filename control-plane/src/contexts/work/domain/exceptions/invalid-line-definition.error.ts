export class InvalidLineDefinitionError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Invalid line definition: ${reason}`);
    this.name = 'InvalidLineDefinitionError';
  }
}
