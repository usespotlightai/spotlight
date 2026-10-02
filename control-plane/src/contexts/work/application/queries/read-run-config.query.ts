export class ReadRunConfigQuery {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly viewerId: string,
  ) {}
}
