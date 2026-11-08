export class SubscribeToPushCommand {
  constructor(
    readonly personId: string,
    readonly endpoint: string,
    readonly p256dh: string,
    readonly auth: string,
  ) {}
}
