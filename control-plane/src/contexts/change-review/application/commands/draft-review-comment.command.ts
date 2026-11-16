export class DraftReviewCommentCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly viewerId: string,
    readonly body: string,
    readonly on: {
      readonly replyTo: string | null;
      readonly repository: string | null;
      readonly path: string;
      readonly side: string | null;
      readonly line: number | null;
      readonly startLine: number | null;
    },
  ) {}
}
