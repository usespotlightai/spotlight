export class RestoreTeamMemoryCommand {
  constructor(
    readonly teamId: string,
    readonly memoryId: string,
    readonly viewerId: string,
  ) {}
}
