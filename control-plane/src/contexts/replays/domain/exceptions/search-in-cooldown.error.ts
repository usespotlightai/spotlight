export class SearchInCooldownError extends Error {
  readonly kind = 'conflict' as const;

  constructor(stationId: string, until: Date) {
    super(
      `Station ${stationId} started a search too recently. Next start allowed: ${until.toISOString()}`,
    );
    this.name = 'SearchInCooldownError';
  }
}
