export class OpenPullRequestCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly title: string,
    readonly body: string,
  ) {}
}
