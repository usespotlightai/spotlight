export class ResolveNoticeCommand {
  constructor(
    readonly noticeId: string,
    readonly slug: string,
    readonly resolvedBy: string,
  ) {}
}
