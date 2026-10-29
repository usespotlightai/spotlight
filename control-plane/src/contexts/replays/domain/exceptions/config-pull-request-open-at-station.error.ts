export class ConfigPullRequestOpenAtStationError extends Error {
  readonly kind = 'conflict' as const;

  constructor(stationId: string) {
    super(`Station ${stationId} already has an open config pull request.`);
    this.name = 'ConfigPullRequestOpenAtStationError';
  }
}
