export class DraftRunChangeStackCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly diff: string,
    readonly repository: string | null,
    readonly base: string | null,
  ) {}
}
