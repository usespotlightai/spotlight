export class RecordRunVerdictCommand {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly viewerId: string,
    readonly right: boolean,
    readonly reason: string | null,
  ) {}
}
