import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunOrderContract } from '@work/application/contracts/run-order.contract';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import type { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason.vo';
import type { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import type { StationConfig } from '@work/domain/value-objects/station-config.vo';

export interface OrderedRun {
  readonly order: RunOrderContract;
  readonly briefedTask: BriefedTask | null;
  readonly briefedMemories: BriefedMemories;
  readonly configuredAs: StationConfig | null;
}

export const runOrderOf = (parts: {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly harness: HarnessId;
  readonly priority: RunPriority;
  readonly placement: RunnerPlacement;
  readonly spec: RunSpec;
  readonly subject: RunSubject | null;
  readonly team: TeamId | null;
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
  spec: RunSpecContract.toWire(parts.spec),
  subject: parts.subject?.values ?? null,
  team: parts.team?.value ?? null,
  refusal:
    parts.refusals.length > 0
      ? parts.refusals.map((each) => ({ description: each.description }))
      : null,
});
