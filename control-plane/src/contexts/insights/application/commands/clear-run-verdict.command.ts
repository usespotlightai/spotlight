export class ClearRunVerdictCommand {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly viewerId: string,
  ) {}
}
