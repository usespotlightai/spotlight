export class EnrolRunnerCommand {
  constructor(readonly name: string) {}
}

export interface RegisteredHarness {
  readonly id: string;
  readonly models: readonly string[];
}

export class RegisterRunnerCommand {
  constructor(
    readonly runnerId: string,
    readonly harnesses: readonly RegisteredHarness[],
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
    readonly sessionId?: string | null,
    readonly stopped: boolean = false,
  ) {}
}

export class EnqueueRunCommand {
  constructor(
    readonly workspaceId: string,
    readonly harness: string,
    readonly spec: unknown,
    readonly targetRunnerId: string | null = null,
  ) {}
}
