export class UnsubscribeFromPushCommand {
  constructor(
    readonly personId: string,
    readonly endpoint: string,
  ) {}
}
