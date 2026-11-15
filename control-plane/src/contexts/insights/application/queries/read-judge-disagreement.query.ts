export class ReadJudgeDisagreementQuery {
  constructor(
    readonly teamId: string,
    readonly disagreementId: string,
    readonly viewerId: string,
  ) {}
}
