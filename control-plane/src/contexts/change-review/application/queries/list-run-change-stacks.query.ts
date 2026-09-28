export class ListRunChangeStacksQuery {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly viewerId: string,
  ) {}
}
