export class ReadStationJudgeQuery {
  constructor(
    readonly teamId: string,
    readonly lineId: string,
    readonly stationId: string,
    readonly viewerId: string,
  ) {}
}
