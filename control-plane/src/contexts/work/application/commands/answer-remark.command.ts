export class AnswerRemarkCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly handle: string,
    readonly body: string,
    readonly resolve: boolean,
  ) {}
}
