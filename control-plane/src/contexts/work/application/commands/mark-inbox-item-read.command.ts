export class MarkInboxItemReadCommand {
  constructor(
    readonly itemId: string,
    readonly readBy: string,
  ) {}
}
