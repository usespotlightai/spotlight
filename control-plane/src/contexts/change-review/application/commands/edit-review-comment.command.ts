export class EditReviewCommentCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly viewerId: string,
    readonly commentId: string,
    readonly body: string,
  ) {}
}
