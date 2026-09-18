export class ReadRunEventsQuery {
  constructor(
    readonly runId: string,
    readonly attempt: number,
    readonly afterSeq: number,
  ) {}
}
