export interface MemoryListing {
  readonly status: string | null;
  readonly kind: string | null;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly repository: string | null;
  readonly path: string | null;
}

export class ListTeamMemoriesQuery {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
    readonly listing: MemoryListing,
  ) {}
}
