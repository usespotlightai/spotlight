export class StoredWorkspaceArchiveQuery {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
  ) {}
}

export class StoredSandboxArchiveQuery {
  constructor(
    readonly sandboxId: string,
    readonly token: string | undefined,
  ) {}
}
