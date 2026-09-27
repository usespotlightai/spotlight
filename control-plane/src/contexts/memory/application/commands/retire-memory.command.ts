export class RetireMemoryCommand {
  constructor(
    readonly teamId: string,
    readonly memoryId: string,
    readonly viewerId: string,
    readonly reason: string,
  ) {}
}
