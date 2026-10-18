export class ReadInboxRequestCommand {
  constructor(
    readonly inboxRequestId: string,
    readonly readBy: string,
  ) {}
}
