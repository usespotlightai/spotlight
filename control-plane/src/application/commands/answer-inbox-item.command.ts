export class AnswerInboxItemCommand {
  constructor(
    // Which conversation, not merely which task.
    readonly itemId: string,
    readonly answeredBy: string,
    readonly body: string,
  ) {}
}
