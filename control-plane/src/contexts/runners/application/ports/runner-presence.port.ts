import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_PRESENCE = Symbol('RUNNER_PRESENCE');

export interface SeenRunner {
  readonly workspaceId: WorkspaceId;
  readonly harnesses: readonly HarnessId[];
  readonly terms: RunnerTerms;
}

export interface RunnerPresencePort {
  seen(runnerId: RunnerId, at: Date): Promise<SeenRunner | null>;

  termsOf(runnerId: RunnerId): Promise<RunnerTerms>;
}
