export class StoredWorkingCopyArchiveQuery {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    // The base of the store that the asking host keeps working copies in, when its working copy hook keeps them.
    readonly base: string | null = null,
  ) {}
}

export class StoredSandboxArchiveQuery {
  constructor(
    readonly sandboxId: string,
    readonly token: string | undefined,
  ) {}
}
