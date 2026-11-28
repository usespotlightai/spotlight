export class BlockTaskCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly blockedBy: readonly string[],
    readonly viewerId: string,
  ) {}
}
