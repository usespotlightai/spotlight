export class ReadMemoryUpkeepQuery {
  constructor(
    readonly teamId: string,
    readonly upkeepId: string,
    readonly viewerId: string,
  ) {}
}
