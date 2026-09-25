export class GrantWorkspaceArchiveCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly size: number,
    readonly sha256: string,
  ) {}
}

export class SealWorkspaceArchiveCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly archiveId: string,
  ) {}
}
