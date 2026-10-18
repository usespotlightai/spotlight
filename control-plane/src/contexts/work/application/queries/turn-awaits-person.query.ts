export class TurnAwaitsPersonQuery {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly exitCode: number,
    readonly failed: boolean,
    readonly stopped: boolean,
    readonly handover: { next?: string; note?: string } | null,
  ) {}
}
