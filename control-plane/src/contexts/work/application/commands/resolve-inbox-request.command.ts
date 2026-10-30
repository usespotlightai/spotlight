export class ResolveInboxRequestCommand {
  constructor(
    readonly inboxRequestId: string,
    readonly resolvedBy: string,
  ) {}
}
