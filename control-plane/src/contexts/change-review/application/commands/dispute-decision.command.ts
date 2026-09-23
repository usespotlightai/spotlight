export class DisputeDecisionCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly decisionId: string,
    readonly path: string,
    readonly viewerId: string,
    readonly reason: string,
  ) {}
}
