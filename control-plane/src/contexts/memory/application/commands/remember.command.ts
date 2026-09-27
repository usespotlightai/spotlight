export interface MemoryRemembering {
  readonly kind: string;
  readonly body: string;
  readonly reach: string | null;
  readonly paths: readonly string[];
  readonly supersedes: string | null;
}

export class RememberCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly remembering: MemoryRemembering,
  ) {}
}
