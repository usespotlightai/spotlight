export class AnswerJudgeDisagreementCommand {
  constructor(
    readonly teamId: string,
    readonly disagreementId: string,
    readonly viewerId: string,
    readonly note: string | null,
    readonly shouldHaveFailed: number | null,
  ) {}
}
