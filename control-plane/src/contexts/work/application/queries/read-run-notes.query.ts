export class ReadRunNotesQuery {
  constructor(
    readonly runId: string,
    readonly viewerId: string,
  ) {}
}
