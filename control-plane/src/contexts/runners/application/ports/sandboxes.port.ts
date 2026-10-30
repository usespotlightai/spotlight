export const SANDBOXES = Symbol('SANDBOXES');

export interface SandboxForRun {
  readonly workspaceId: string;
  readonly key: string | null;
  readonly hostId: string;
  readonly runId: string;
}

export interface SandboxesPort {
  holdForRun(run: SandboxForRun, at: Date): Promise<string>;

  releaseRun(runId: string, at: Date): Promise<void>;
}
