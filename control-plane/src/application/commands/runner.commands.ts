export class EnrolRunnerCommand {
  constructor(readonly name: string) {}
}

export class RegisterRunnerCommand {
  constructor(
    readonly runnerId: string,
    /** What the runner found installed, by harness id. */
    readonly harnesses: readonly string[],
  ) {}
}

export class RevokeRunnerCommand {
  constructor(readonly runnerId: string) {}
}

export class ClaimRunCommand {
  constructor(readonly runnerId: string) {}
}

export class RenewLeaseCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
  ) {}
}

export interface AppendedEvent {
  readonly seq: number;
  readonly type: string;
  readonly at: string;
  readonly message?: string;
  readonly data?: string;
  readonly offset?: number;
}

export class AppendRunEventsCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly events: readonly AppendedEvent[],
  ) {}
}

export class CompleteRunCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly exitCode: number,
    readonly failed: boolean,
    readonly message?: string,
    readonly declared?: { next?: string; note?: string } | null,
  ) {}
}

export class EnqueueRunCommand {
  constructor(
    readonly workspaceId: string,
    readonly harness: string,
    readonly spec: unknown,
    /** Null lets any runner that has the harness take it. */
    readonly targetRunnerId: string | null = null,
  ) {}
}
