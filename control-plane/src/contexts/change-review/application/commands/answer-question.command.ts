export class AnswerQuestionCommand {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly stackId: string,
    readonly questionId: string,
    readonly viewerId: string,
    readonly reply: string | null,
  ) {}
}
