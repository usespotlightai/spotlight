import type { HostCredentials } from '@runners/application/ports/runner-authenticator.port';
export class ClaimRunCommand {
  constructor(readonly runnerId: string) {}
}

export class RenewLeaseCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
  ) {}
}

export class RenewReviewWorkLeaseCommand {
  constructor(
    readonly work:
      | {
          readonly kind: 'check';
          readonly stackId: string;
          readonly recheck: boolean;
        }
      | { readonly kind: 'diff'; readonly diffId: string },
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

export interface ReportedCheckout {
  readonly path: string;
  readonly commit: string;
}

export class RecordStartingPointCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly attempt: number,
    readonly archiveId: string | null,
    readonly checkouts: readonly ReportedCheckout[] | null,
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
    readonly handover?: {
      next?: string;
      note?: string;
      suggest?: string;
      attachments?: readonly string[];
    } | null,
    readonly sessionId?: string | null,
    readonly stopped: boolean = false,
    readonly setupFailed: boolean = false,
    readonly timedOut: boolean = false,
    readonly heads: readonly { path: string; commit: string }[] = [],
  ) {}
}

export class EnqueueRunCommand {
  constructor(
    readonly slug: string,
    readonly viewerId: string,
    readonly harness: string,
    readonly spec: Readonly<Record<string, unknown>>,
  ) {}
}

export class ClaimHostWorkCommand {
  constructor(
    readonly credential: HostCredentials,
    readonly host: string,
    readonly image: string,
    readonly sandbox: string | null = null,
  ) {}
}
