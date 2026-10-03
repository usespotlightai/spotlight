export class SettleNoticeCommand {
  constructor(
    readonly noticeId: string,
    readonly slug: string,
    readonly settledBy: string,
  ) {}
}
