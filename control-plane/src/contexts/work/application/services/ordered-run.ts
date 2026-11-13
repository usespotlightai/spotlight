import type {
  RunApiGrantContract,
  RunOrderContract,
  RunPolicyContract,
  RunRequesterContract,
  RunWorkingCopyContract,
} from '@runs/application/contracts/run-order.contract';
import type { RunSpecShape } from '@runs/application/contracts/run-spec.contract';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason';
import type { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { StationConfig } from '@work/domain/value-objects/station-config.vo';

export interface OrderedRun {
  readonly order: RunOrderContract;
  readonly briefedTask: BriefedTask | null;
  readonly briefedMemories: BriefedMemories;
  readonly configuredAs: StationConfig | null;
  readonly toolsOnMarks: readonly Tool[];
}

export const runOrderOf = (parts: {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly harness: HarnessId;
  readonly priority: RunPriority;
  readonly placement: RunnerPlacement;
  readonly spec: RunSpecShape;
  readonly requester: RunRequesterContract;
  readonly policy: RunPolicyContract;
  readonly workingCopy: RunWorkingCopyContract;
  readonly apiGrant: RunApiGrantContract | null;
  readonly tags: Readonly<Record<string, string>>;
  readonly line: LineId | null;
  readonly refusals: readonly RefusalReason[];
}): RunOrderContract => ({
  runId: parts.id.value,
  workspaceId: parts.workspaceId.value,
  harness: parts.harness.value,
  priority: parts.priority.value,
  placement: {
    labelGroups: parts.placement.labelGroups,
    image: parts.placement.image?.value ?? null,
  },
  spec: parts.spec,
  requester: parts.requester,
  policy: parts.policy,
  workingCopy: parts.workingCopy,
  restore: null,
  extensions: {},
  apiGrant: parts.apiGrant,
  tags: parts.tags,
  line: parts.line?.value ?? null,
  refusal:
    parts.refusals.length > 0
      ? parts.refusals.map((each) => ({ description: each.description }))
      : null,
});
