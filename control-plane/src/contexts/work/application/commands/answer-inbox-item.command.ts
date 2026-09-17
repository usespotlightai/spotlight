export class AnswerInboxItemCommand {
  constructor(
    readonly itemId: string,
    readonly answeredBy: string,
    readonly body: string,
    readonly attachments: readonly string[] = [],
  ) {}
}
