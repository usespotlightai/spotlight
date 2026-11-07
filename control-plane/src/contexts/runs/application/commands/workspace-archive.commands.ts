export class GrantWorkspaceArchiveCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly size: number,
    readonly sha256: string,
  ) {}
}

export class CompleteWorkspaceArchiveCommand {
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

export class CompleteSandboxArchiveCommand {
  constructor(
    readonly sandboxId: string,
    readonly token: string | undefined,
    readonly archiveId: string,
  ) {}
}
