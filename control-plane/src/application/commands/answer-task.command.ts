export class AnswerTaskCommand {
  constructor(
    readonly taskId: string,
    readonly answeredBy: string,
    readonly body: string,
  ) {}
}
