export class TurnAsksAPersonQuery {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly exitCode: number,
    readonly failed: boolean,
    readonly stopped: boolean,
    readonly declared: { next?: string; note?: string } | null,
  ) {}
}
