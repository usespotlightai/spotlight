import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { type GivenToRun, givenAt } from '@work/domain/services/given-to-run';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';
import {
  checkoutsOf,
  type TaskCheckout,
} from '@work/domain/services/task-checkouts';
import type { Continuity } from '@work/domain/value-objects/continuity.vo';
import type { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';
import type { Effort } from '@work/domain/value-objects/effort.vo';
import type { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import type { Harness } from '@work/domain/value-objects/harness.vo';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';
import type { ReadySkill } from '@work/domain/value-objects/ready-skill';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { StationCheck } from '@work/domain/value-objects/station-check.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export interface RunOrder {
  readonly harness: Harness;
  readonly model: HarnessModel | null;
  readonly effort: Effort | null;
  readonly stationId: StationId;
  readonly priority: RunPriority;
  readonly placement: RunnerPlacement;
  readonly options: readonly HandoverOption[];
  readonly noteLimit: number;
  readonly continuity: Continuity;
  readonly checkouts: readonly TaskCheckout[];
  readonly given: GivenToRun;
  readonly diffs: boolean;
  readonly check: StationCheck | null;
  readonly refusal: RunOutcome | null;
}

export interface OrderedAt {
  readonly stationId: StationId;
  readonly continuity: Continuity;
  readonly checkouts: readonly TaskCheckout[];
}

interface Ordering {
  line: Line;
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

  const harness = harnesses.named(station.harness);

  if (!harness) {
    return null;
  }

  const given = givenAt(station, ready, profiles);
  const refusals = [...denied, ...given.refusals];

  return {
    harness,
    model: station.model,
    effort: station.effort,
    stationId: station.id,
    priority: RunPriority.of(line.depthOf(station.id)),
    placement: line.placementOf(station.id),
    options: line.optionsFrom(station.id),
    noteLimit: 0,
    continuity: at.continuity,
    checkouts: at.checkouts,
    given,
    diffs: station.diffs,
    check: station.diffs ? station.check : null,
    refusal: refusals.length > 0 ? RunOutcome.refused(refusals) : null,
  };
};

export const taskOrderedAt = (task: Task, line: Line): OrderedAt => ({
  stationId: task.stationId,
  continuity: task.continuity(),
  checkouts: checkoutsOf(task, line),
});

export const orderFor = ({
  task,
  ...ordering
}: Ordering & { task: Task }): RunOrder | null =>
  orderAt({ ...ordering, at: taskOrderedAt(task, ordering.line) });
