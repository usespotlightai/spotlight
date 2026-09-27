export class ReadBriefedMemoriesQuery {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly viewerId: string,
  ) {}
}
