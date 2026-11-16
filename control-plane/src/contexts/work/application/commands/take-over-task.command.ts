export class TakeOverTaskCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly viewerId: string,
    readonly verdict: string | null,
    readonly body: string | null,
  ) {}
}

export interface TakenOver {
  readonly takeoverId: string;
  readonly runId: string | null;
}
