export class FindStationQuery {
  constructor(
    readonly teamId: string,
    readonly lineId: string,
    readonly stationId: string,
    readonly viewerId: string,
  ) {}
}
