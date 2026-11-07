import type { Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import {
  type EnabledForRun,
  enabledAt,
} from '@work/domain/services/enabled-for-run';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';
import {
  checkoutsOf,
  type TaskCheckout,
} from '@work/domain/services/task-checkouts';
import type { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';
import type { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';
import type { ReadySkill } from '@work/domain/value-objects/ready-skill';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason.vo';
import type { Resume } from '@work/domain/value-objects/resume.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';

export interface RunOrder {
  readonly harness: HarnessId;
  readonly model: HarnessModel | null;
  readonly effort: Effort | null;
  readonly stationId: StationId;
  readonly priority: RunPriority;
  readonly placement: RunnerPlacement;
  readonly options: readonly HandoverOption[];
  readonly noteLimit: number;
  readonly resume: Resume;
  readonly checkouts: readonly TaskCheckout[];
  readonly enabled: EnabledForRun;
  readonly diffs: boolean;
  readonly check: string | null;
  readonly refusals: readonly RefusalReason[];
}

export interface OrderedAt {
  readonly stationId: StationId;
  readonly resume: Resume;
  readonly checkouts: readonly TaskCheckout[];
}

interface Ordering {
  line: LineMap;
  harnesses: HarnessCatalog;
  ready: readonly ReadySkill[];
  profiles: readonly ReadyProfile[];
  denied?: readonly DeniedCatalogItem[];
}

export const orderAt = ({
  at,
  line,
  harnesses,
  ready,
  profiles,
  denied = [],
}: Ordering & { at: OrderedAt }): RunOrder | null => {
  const station = line.stationAt(at.stationId);

  if (!station?.harness) {
    return null;
  }

  const harness = station.harness;

  if (!harnesses.knows(harness)) {
    return null;
  }

  const enabled = enabledAt(station, ready, profiles);
  const refusals = [...denied, ...enabled.refusals];

  return {
    harness,
    model: station.model,
    effort: station.effort,
    stationId: station.id,
    priority: RunPriority.of(line.depthOf(station.id)),
    placement: line.placementOf(station.id),
    options: line.optionsFrom(station.id),
    noteLimit: 0,
    resume: at.resume,
    checkouts: at.checkouts,
    enabled,
    diffs: station.diffs,
    check: station.diffs ? station.check : null,
    refusals,
  };
};

export const taskOrderedAt = (task: Task, line: LineMap): OrderedAt => ({
  stationId: task.stationId,
  resume: task.resume(),
  checkouts: checkoutsOf(task, line),
});

export const orderFor = ({
  task,
  ...ordering
}: Ordering & { task: Task }): RunOrder | null =>
  orderAt({ ...ordering, at: taskOrderedAt(task, ordering.line) });
