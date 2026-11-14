import type { AppendedJournalEntry } from '@runs/application/commands/runner.commands';

export class GrantWorkingCopyArchiveCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly size: number,
    readonly sha256: string,
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
    readonly size: number,
    readonly sha256: string,
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
