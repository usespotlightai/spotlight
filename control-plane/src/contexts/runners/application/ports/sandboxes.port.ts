import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';

export const SANDBOXES = Symbol('SANDBOXES');

export interface SandboxForRun {
  readonly workspaceId: string;
  readonly key: string | null;
  readonly line: string | null;
  readonly lineFingerprint: string | null;
  readonly hostId: string;
  readonly runId: string;
}

export interface StartedSandbox {
  readonly id: string;
  readonly token: string;
}

export type SandboxTakingRuns =
  | {
      readonly id: string;
      readonly workspaceId: string;
      readonly key: string;
    }
  | {
      readonly id: string;
      readonly workspaceId: string;
      readonly warmFor: string;
      readonly fingerprint: string;
    };

export interface WarmStart {
  readonly line: string;
  readonly checkouts: readonly {
    readonly path: string;
    readonly setup: string | null;
  }[];
}

export interface StartedWarmSandbox extends StartedSandbox {
  readonly warm: WarmStart;
}

export interface ReadyWarmSandbox {
  readonly id: string;
  readonly line: string;
  readonly fingerprint: string;
}

type SandboxStatus = 'starting' | 'ready' | 'draining' | 'gone';

export interface OpenedSandbox {
  readonly id: string;
  readonly state: SandboxStatus;
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

  retireRun(runId: string, at: Date): Promise<void>;

  holdArchive(
    sandboxId: string,
    runId: string,
    attempt: number,
    at: Date,
  ): Promise<boolean>;

  renewArchive(
    sandboxId: string,
    runId: string,
    attempt: number,
    at: Date,
  ): Promise<boolean>;

  releaseArchive(
    sandboxId: string,
    runId: string,
    attempt: number,
    at: Date,
  ): Promise<void>;

  archivedAttemptOf(
    sandboxId: string,
    runId: string,
    at: Date,
  ): Promise<number | null>;

  open(workspaceId: string, key: string, at: Date): Promise<OpenedSandbox>;

  requestedIn(workspaceId: string): Promise<readonly RequestedSandbox[]>;

  startRequested(
    sandboxId: string,
    hostId: string,
    at: Date,
  ): Promise<StartedSandbox | null>;

  drain(sandboxId: string): Promise<void>;

  requestedWarmIn(workspaceId: string): Promise<readonly string[]>;

  startWarm(
    sandboxId: string,
    hostId: string,
    offer: RunnerOffer,
    at: Date,
  ): Promise<StartedWarmSandbox | null>;

  readyWarmIn(
    workspaceId: string,
    at: Date,
  ): Promise<readonly ReadyWarmSandbox[]>;

  adoptForRun(
    sandboxId: string,
    run: SandboxForRun,
    at: Date,
  ): Promise<boolean>;

  authenticate(token: string | undefined): Promise<AuthenticatedSandbox | null>;
}
