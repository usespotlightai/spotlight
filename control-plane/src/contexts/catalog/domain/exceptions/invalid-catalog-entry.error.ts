export class InvalidCatalogEntryError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: 'name' | 'version',
    readonly because: string,
  ) {
    super(because);
    this.name = 'InvalidCatalogEntryError';
  }
}
