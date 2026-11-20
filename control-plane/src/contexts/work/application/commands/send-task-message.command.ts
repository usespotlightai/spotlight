export class SendTaskMessageCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly sentBy: string,
    readonly body: string,
    readonly attachments: readonly string[] = [],
    readonly coAuthors: readonly string[] = [],
    readonly draftGeneration: number | null = null,
  ) {}
}
