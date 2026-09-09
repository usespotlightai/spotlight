export class OpenPullRequestCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly title: string,
    readonly body: string,
    /** Which of the line's repositories, by name. Null names the only one. */
    readonly repository: string | null,
  ) {}
}
