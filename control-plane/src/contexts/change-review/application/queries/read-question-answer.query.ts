export class ReadQuestionAnswerQuery {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly stackId: string,
    readonly questionId: string,
    readonly viewerId: string,
  ) {}
}
