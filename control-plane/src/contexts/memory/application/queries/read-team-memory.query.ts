export class ReadTeamMemoryQuery {
  constructor(
    readonly teamId: string,
    readonly memoryId: string,
    readonly viewerId: string,
  ) {}
}
