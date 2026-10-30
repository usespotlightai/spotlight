export const SANDBOXES = Symbol('SANDBOXES');

export interface SandboxForRun {
  readonly workspaceId: string;
  readonly key: string | null;
  readonly hostId: string;
  readonly runId: string;
}

export interface SandboxTakingRuns {
  readonly id: string;
  readonly workspaceId: string;
  readonly key: string;
}

export interface SandboxesPort {
  holdForRun(run: SandboxForRun, at: Date): Promise<string>;

  takingRuns(
    sandboxId: string,
    hostId: string,
  ): Promise<SandboxTakingRuns | null>;

  holdInSandbox(
    sandboxId: string,
    run: SandboxForRun,
    at: Date,
  ): Promise<boolean>;

  liveKeysIn(workspaceId: string, at: Date): Promise<readonly string[]>;

  releaseRun(runId: string, at: Date): Promise<void>;
}
