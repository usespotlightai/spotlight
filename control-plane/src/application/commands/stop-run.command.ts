export class StopRunCommand {
  constructor(
    readonly runId: string,
    readonly stoppedBy: string,
  ) {}
}
