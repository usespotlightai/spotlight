export class SubmitReviewCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly viewerId: string,
    readonly verdict: string,
    readonly body: string,
    readonly repository: string | null,
  ) {}
}
