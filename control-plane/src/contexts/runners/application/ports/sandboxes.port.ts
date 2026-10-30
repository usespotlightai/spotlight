import type { SandboxState } from '@runners/domain/aggregates/sandbox.aggregate';

export const SANDBOXES = Symbol('SANDBOXES');

export interface SandboxForRun {
  readonly workspaceId: string;
  readonly key: string | null;
  readonly hostId: string;
  readonly runId: string;
}

export interface StartedSandbox {
  readonly id: string;
  readonly token: string;
}

export interface SandboxTakingRuns {
  readonly id: string;
  readonly workspaceId: string;
  readonly key: string;
}

export interface OpenedSandbox {
  readonly id: string;
  readonly state: SandboxState;
}

export interface RequestedSandbox {
  readonly id: string;
  readonly key: string;
}

export interface AuthenticatedSandbox {
  readonly id: string;
  readonly workspaceId: string;
  readonly key: string | null;
}

export interface SandboxesPort {
  holdForRun(run: SandboxForRun, at: Date): Promise<StartedSandbox>;

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

  open(workspaceId: string, key: string, at: Date): Promise<OpenedSandbox>;

  requestedIn(workspaceId: string): Promise<readonly RequestedSandbox[]>;

  startRequested(
    sandboxId: string,
    hostId: string,
    at: Date,
  ): Promise<StartedSandbox | null>;

  drain(sandboxId: string): Promise<void>;

  authenticate(token: string | undefined): Promise<AuthenticatedSandbox | null>;
}
