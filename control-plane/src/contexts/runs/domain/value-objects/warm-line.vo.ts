import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WarmCheckout {
  readonly path: string;
  readonly setup: string | null;
}

export interface WarmLine {
  readonly id: LineId;
  readonly workspaceId: WorkspaceId;
  readonly checkouts: readonly WarmCheckout[];
  readonly placement: RunnerPlacement;
  readonly warmSandboxes: number;
}
