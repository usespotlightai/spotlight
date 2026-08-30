export class ReadInboxItemCommand {
  constructor(
    // Which conversation: a task can need someone more than once.
    readonly itemId: string,
    readonly readBy: string,
  ) {}
}
