export class ReopenNoticeCommand {
  constructor(
    readonly noticeId: string,
    readonly slug: string,
    readonly reopenedBy: string,
  ) {}
}
