export class ResolveInboxItemCommand {
  constructor(
    readonly itemId: string,
    readonly resolvedBy: string,
  ) {}
}
