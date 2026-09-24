export class ClaimRunCommand {
  constructor(readonly runnerId: string) {}
}

export class RenewLeaseCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
  ) {}
}

export interface AppendedJournalEntry {
  readonly seq: number;
  readonly type: string;
  readonly at: string;
  readonly message?: string;
  readonly data?: string;
}

export class AppendRunJournalCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly entries: readonly AppendedJournalEntry[],
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
    readonly slug: string,
    readonly viewerId: string,
    readonly harness: string,
    readonly spec: unknown,
    readonly targetRunnerId: string | null = null,
  ) {}
}

export interface PoolHarnessReport {
  readonly id: string;
  readonly models: readonly string[];
  readonly version?: string;
}

export class ClaimPoolWorkCommand {
  constructor(
    readonly token: string | undefined,
    readonly harnesses: readonly PoolHarnessReport[],
  ) {}
}
