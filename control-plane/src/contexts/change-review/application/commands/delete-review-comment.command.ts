export class DeleteReviewCommentCommand {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly viewerId: string,
    readonly commentId: string,
  ) {}
}
