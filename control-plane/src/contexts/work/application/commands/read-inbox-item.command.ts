export class ReadInboxItemCommand {
  constructor(
    readonly itemId: string,
    readonly readBy: string,
  ) {}
}
