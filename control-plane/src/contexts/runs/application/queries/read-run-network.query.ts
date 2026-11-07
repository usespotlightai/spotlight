export class ReadRunNetworkQuery {
  constructor(
    readonly teamId: string | null,
    readonly runId: string,
    readonly viewerId: string,
  ) {}
}
