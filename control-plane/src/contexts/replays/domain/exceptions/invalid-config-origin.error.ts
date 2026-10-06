export class InvalidConfigOriginError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`Config origin ${reason}.`);
    this.name = 'InvalidConfigOriginError';
  }
}
