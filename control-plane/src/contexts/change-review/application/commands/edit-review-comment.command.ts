export class EditReviewCommentCommand {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly viewerId: string,
    readonly commentId: string,
    readonly body: string,
  ) {}
}
