import type { RunTokensPort } from '@identity/application/ports/run-tokens.port';
import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import type { RunGrantsPort } from '@secrets/application/ports/run-grants.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface EndedAttempt {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly attempt: RunAttempt;
}

export class RunCredentials {
  constructor(
    private readonly grants: RunGrantsPort,
    private readonly tokens: RunTokensPort,
  ) {}

  endGrantsOf(run: EndedAttempt): Promise<void> {
    return this.grants.endedFor(leaseOf(run));
  }

  loseGrantLeaseOf(run: EndedAttempt): Promise<void> {
    return this.grants.leaseLost(leaseOf(run));
  }

  revokeTokensOf(run: EndedAttempt): Promise<void> {
    return this.tokens.revokeFor(run.workspaceId, run.runId, null);
  }

  revokeAttemptTokensOf(run: EndedAttempt): Promise<void> {
    return this.tokens.revokeFor(
      run.workspaceId,
      run.runId,
      run.attempt.number,
    );
  }
}

const leaseOf = (run: EndedAttempt) => ({
  workspaceId: run.workspaceId.value,
  runId: run.runId.value,
  attempt: run.attempt.number,
});
