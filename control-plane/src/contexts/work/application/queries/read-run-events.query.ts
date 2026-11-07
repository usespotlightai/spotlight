export class ReadRunEventsQuery {
  constructor(
    readonly runId: string,
    readonly viewerId: string,
    readonly attempt: number,
    readonly afterSeq: number,
  ) {}
}
