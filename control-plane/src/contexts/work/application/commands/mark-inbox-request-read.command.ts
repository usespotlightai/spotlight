export class MarkInboxRequestReadCommand {
  constructor(
    readonly inboxRequestId: string,
    readonly readBy: string,
  ) {}
}
