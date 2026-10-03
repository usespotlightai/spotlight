export class ReadNoticeCommand {
  constructor(
    readonly noticeId: string,
    readonly slug: string,
    readonly readBy: string,
  ) {}
}
