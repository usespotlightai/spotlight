export class DeleteReviewCommentCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly viewerId: string,
    readonly commentId: string,
  ) {}
}
