import type { WarmFingerprint } from '@runs/domain/value-objects/warm-fingerprint.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

type Claims = 'any' | 'reserved';

export type SandboxRouting =
  | { readonly into: WorkingCopyKey }
  | { readonly avoiding: readonly WorkingCopyKey[] }
  | {
      readonly firstOfLine: LineId;
      readonly fingerprint: WarmFingerprint;
      readonly avoiding: readonly WorkingCopyKey[];
    };

export interface Claimant {
  readonly runner: RunnerId;
  readonly workspaceId: WorkspaceId;
  readonly harnesses: readonly HarnessId[];
  readonly offer: RunnerOffer;
  readonly claims: Claims;
  readonly sandbox?: SandboxRouting;
}
