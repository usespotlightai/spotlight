export type ConfigFolderField = 'repository' | 'folder';

export class InvalidConfigFolderError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: ConfigFolderField,
    reason: string,
  ) {
    super(`Config folder ${field} ${reason}.`);
    this.name = 'InvalidConfigFolderError';
  }
}
