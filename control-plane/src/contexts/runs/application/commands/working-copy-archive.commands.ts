import type { AppendedJournalEntry } from '@runs/application/commands/runner.commands';

// A tar the runner uploads to Spotlight's storage, or a snapshot its host makes, which descends from base. Where it is
// kept follows from the runner's pool or trust, not from the request.
export type ArchiveGrantRequest =
  | { readonly kind: 'tar'; readonly size: number; readonly sha256: string }
  | { readonly kind: 'snapshot'; readonly base: string | null };

export class GrantWorkingCopyArchiveCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly archive: ArchiveGrantRequest,
  ) {}
}

export class CompleteWorkingCopyArchiveCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly archiveId: string,
  ) {}
}

export class GrantSandboxArchiveCommand {
  constructor(
    readonly sandboxId: string,
    readonly token: string | undefined,
    readonly archive: ArchiveGrantRequest,
  ) {}
}

export class HoldSandboxArchiveCommand {
  constructor(
    readonly sandboxId: string,
    readonly token: string | undefined,
    readonly runId: string,
    readonly attempt: number,
  ) {}
}

export class ReleaseSandboxArchiveCommand {
  constructor(
    readonly sandboxId: string,
    readonly token: string | undefined,
    readonly runId: string,
    readonly attempt: number,
  ) {}
}

export class AppendSandboxArchiveJournalCommand {
  constructor(
    readonly sandboxId: string,
    readonly token: string | undefined,
    readonly runId: string,
    readonly entries: readonly AppendedJournalEntry[],
  ) {}
}

export class CompleteSandboxArchiveCommand {
  constructor(
    readonly sandboxId: string,
    readonly token: string | undefined,
    readonly archiveId: string,
  ) {}
}
