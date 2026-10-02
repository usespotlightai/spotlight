export class ProposeSearchCandidateCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly name: unknown,
    readonly hypothesis: unknown,
    readonly station: unknown,
  ) {}
}
