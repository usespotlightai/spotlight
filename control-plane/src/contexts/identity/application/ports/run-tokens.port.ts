import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUN_TOKENS = Symbol('RUN_TOKENS');

export interface RunTokenWanted {
  readonly workspaceId: WorkspaceId;
  readonly runId: RunId;
  readonly attempt: number;
  readonly issuedBy: UserId;
  readonly scopes: readonly string[];
  readonly expiresAt: Date;
}

export interface IssuedRunToken {
  readonly id: string;
  readonly token: string;
}

export interface RunTokensPort {
  issueFor(wanted: RunTokenWanted): Promise<IssuedRunToken>;

  revoke(workspaceId: WorkspaceId, tokenId: string): Promise<void>;

  revokeFor(
    workspaceId: WorkspaceId,
    runId: RunId,
    attempt: number | null,
  ): Promise<void>;
}
