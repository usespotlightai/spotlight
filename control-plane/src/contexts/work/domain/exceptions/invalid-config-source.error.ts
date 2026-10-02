export type ConfigSourceField = 'repository' | 'path';

export class InvalidConfigSourceError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: ConfigSourceField,
    reason: string,
  ) {
    super(reason);
    this.name = 'InvalidConfigSourceError';
  }
}
