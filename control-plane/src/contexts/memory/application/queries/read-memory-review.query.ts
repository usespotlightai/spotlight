export class ReadMemoryReviewQuery {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly runId: string,
    readonly viewerId: string,
  ) {}
}
