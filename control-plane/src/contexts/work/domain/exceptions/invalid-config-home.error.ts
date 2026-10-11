export type ConfigHomeField = 'repository' | 'folder';

export class InvalidConfigHomeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: ConfigHomeField,
    reason: string,
  ) {
    super(`Config home ${field} ${reason}.`);
    this.name = 'InvalidConfigHomeError';
  }
}
