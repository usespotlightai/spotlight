export class ReopenInboxRequestCommand {
  constructor(
    readonly inboxRequestId: string,
    readonly reopenedBy: string,
  ) {}
}
