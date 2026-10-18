export class ReadStationInsightsQuery {
  constructor(
    readonly teamId: string,
    readonly lineId: string | null,
    readonly stationId: string,
    readonly viewerId: string,
    readonly last: number | null,
  ) {}
}
