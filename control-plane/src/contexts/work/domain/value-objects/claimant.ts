import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceKey } from '@work/domain/value-objects/workspace-key.vo';

type Claims = 'any' | 'reserved';

export type SandboxRouting =
  | { readonly into: WorkspaceKey }
  | { readonly avoiding: readonly WorkspaceKey[] };

export interface Claimant {
  readonly runner: RunnerId;
  readonly workspaceId: WorkspaceId;
  readonly harnesses: readonly HarnessId[];
  readonly offer: RunnerOffer;
  readonly claims: Claims;
  readonly sandbox?: SandboxRouting;
}
