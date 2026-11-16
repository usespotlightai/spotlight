export class ReadQuestionAnswerQuery {
  constructor(
    readonly teamId: string,
    readonly stackId: string,
    readonly questionId: string,
    readonly viewerId: string,
  ) {}
}
