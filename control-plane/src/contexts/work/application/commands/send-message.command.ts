export class SendMessageCommand {
  constructor(
    readonly runId: string,
    readonly sentBy: string,
    readonly body: string,
    readonly attachments: readonly string[] = [],
    readonly coAuthors: readonly string[] = [],
    readonly draftGeneration: number | null = null,
  ) {}
}
