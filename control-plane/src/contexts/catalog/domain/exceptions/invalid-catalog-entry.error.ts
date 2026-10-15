export class InvalidCatalogEntryError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: 'name' | 'version',
    readonly because: string,
  ) {
    super(because);
    this.name = 'InvalidCatalogEntryError';
  }
}
