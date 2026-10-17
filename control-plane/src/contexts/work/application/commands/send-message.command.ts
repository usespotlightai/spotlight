export class SendMessageCommand {
  constructor(
    readonly runId: string,
    readonly sentBy: string,
    readonly body: string,
    readonly attachments: readonly string[] = [],
  ) {}
}
