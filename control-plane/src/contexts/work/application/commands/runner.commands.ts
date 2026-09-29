import type { HostCredential } from '@runners/application/ports/runner-admissions.port';
export class ClaimRunCommand {
  constructor(readonly runnerId: string) {}
}

export class RenewLeaseCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
  ) {}
}

export class RenewCheckLeaseCommand {
  constructor(
    readonly runId: string,
    readonly stackId: string,
    readonly runnerId: string,
  ) {}
}

export class RecordRunImageCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly image: string,
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
    readonly kept: boolean = false,
  ) {}
}

export class EnqueueRunCommand {
  constructor(
    readonly slug: string,
    readonly viewerId: string,
    readonly harness: string,
    readonly spec: unknown,
  ) {}
}

export class ClaimHostWorkCommand {
  constructor(
    readonly credential: HostCredential,
    readonly host: string,
    readonly image: string,
  ) {}
}

export class ParkRunCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly cold: boolean = false,
  ) {}
}
