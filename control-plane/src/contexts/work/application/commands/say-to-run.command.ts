export class SayToRunCommand {
  constructor(
    readonly runId: string,
    readonly saidBy: string,
    readonly body: string,
    readonly attachments: readonly string[] = [],
  ) {}
}
