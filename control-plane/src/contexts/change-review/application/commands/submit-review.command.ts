export class SubmitReviewCommand {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly viewerId: string,
    readonly verdict: string,
    readonly body: string,
  ) {}
}
