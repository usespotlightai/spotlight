export class AnswerDisagreementClaimCommand {
  constructor(
    readonly teamId: string,
    readonly disagreementId: string,
    readonly viewerId: string,
    readonly claim: number,
    readonly answer: string,
    readonly note: string | null,
  ) {}
}
