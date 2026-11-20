export class ListTaskPullRequestsQuery {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly viewerId: string,
  ) {}
}
