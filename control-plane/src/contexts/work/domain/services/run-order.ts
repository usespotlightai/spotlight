import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { type GivenToRun, givenAt } from '@work/domain/services/given-to-run';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';
import type { Branch } from '@work/domain/value-objects/branch.vo';
import type { Continuity } from '@work/domain/value-objects/continuity.vo';
import type { Effort } from '@work/domain/value-objects/effort.vo';
import type { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import type { Harness } from '@work/domain/value-objects/harness.vo';
import type { ReadySkill } from '@work/domain/value-objects/ready-skill';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export type CheckoutDiff = 'worktree' | 'commits';

export interface OrderedCheckout {
  readonly repository: Repository;
  readonly branch: Branch | null;
  readonly ref: string | null;
  readonly diffOf: CheckoutDiff;
}

const checkoutsFor = (task: Task, line: Line): readonly OrderedCheckout[] => {
  const reviewed = task.reviewed;
  const ref = task.pullRequest?.headRef ?? null;

  if (reviewed && ref) {
    return [{ repository: reviewed, branch: null, ref, diffOf: 'commits' }];
  }

  return line.repositories.all.map((repository) => ({
    repository,
    branch: task.branch,
    ref: null,
    diffOf: 'worktree',
  }));
};

export interface RunOrder {
  readonly harness: Harness;
  readonly model: HarnessModel | null;
  readonly effort: Effort | null;
  readonly stationId: StationId;
  readonly priority: RunPriority;
  readonly pinnedTo: RunnerId | null;
  readonly options: readonly HandoverOption[];
  readonly noteLimit: number;
  readonly continuity: Continuity;
  readonly checkouts: readonly OrderedCheckout[];
  readonly given: GivenToRun;
  readonly diffs: boolean;
}

export const orderFor = ({
  task,
  line,
  harnesses,
  ready,
}: {
  task: Task;
  line: Line;
  harnesses: HarnessCatalog;
  ready: readonly ReadySkill[];
}): RunOrder | null => {
  const station = line.stationAt(task.stationId);

  if (!station?.harness) {
    return null;
  }

  const harness = harnesses.named(station.harness);

  if (!harness) {
    return null;
  }

  const continuity = task.continuity();

  return {
    harness,
    model: station.model,
    effort: station.effort,
    stationId: station.id,
    priority: RunPriority.of(line.depthOf(station.id)),
    pinnedTo: continuity.pinnedTo,
    options: line.optionsFrom(station.id),
    noteLimit: 0,
    continuity,
    checkouts: checkoutsFor(task, line),
    given: givenAt(station, ready),
    diffs: station.diffs,
  };
};
