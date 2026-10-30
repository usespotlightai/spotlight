export class ReopenInboxItemCommand {
  constructor(
    readonly itemId: string,
    readonly reopenedBy: string,
  ) {}
}
