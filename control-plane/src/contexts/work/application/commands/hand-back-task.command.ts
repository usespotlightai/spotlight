export class HandBackTaskCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly viewerId: string,
    readonly next: string,
    readonly stationId: string | null,
    readonly verdict: string | null,
    readonly summary: string | null,
  ) {}
}
