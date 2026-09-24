import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { type GivenToRun, givenAt } from '@work/domain/services/given-to-run';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';
import type { Branch } from '@work/domain/value-objects/branch.vo';
import type { CatalogWithheld } from '@work/domain/value-objects/catalog-withheld.vo';
import type { Continuity } from '@work/domain/value-objects/continuity.vo';
import type { Effort } from '@work/domain/value-objects/effort.vo';
import type { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import type { Harness } from '@work/domain/value-objects/harness.vo';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';
import type { ReadySkill } from '@work/domain/value-objects/ready-skill';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

type CheckoutDiff = 'worktree' | 'commits';

interface OrderedCheckout {
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
  readonly placement: RunnerPlacement;
  readonly options: readonly HandoverOption[];
  readonly noteLimit: number;
  readonly continuity: Continuity;
  readonly checkouts: readonly OrderedCheckout[];
  readonly given: GivenToRun;
  readonly diffs: boolean;
  readonly refusal: RunOutcome | null;
}

export const orderFor = ({
  task,
  line,
  harnesses,
  ready,
  profiles,
  withheld = [],
}: {
  task: Task;
  line: Line;
  harnesses: HarnessCatalog;
  ready: readonly ReadySkill[];
  profiles: readonly ReadyProfile[];
  withheld?: readonly CatalogWithheld[];
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
  const given = givenAt(station, ready, profiles);
  const refusals = [...withheld, ...given.refusals];

  return {
    harness,
    model: station.model,
    effort: station.effort,
    stationId: station.id,
    priority: RunPriority.of(line.depthOf(station.id)),
    placement: RunnerPlacement.every([
      line.placementOf(station.id),
      station.releasePlacement,
    ]),
    options: line.optionsFrom(station.id),
    noteLimit: 0,
    continuity,
    checkouts: checkoutsFor(task, line),
    given,
    diffs: station.diffs,
    refusal: refusals.length > 0 ? RunOutcome.refused(refusals) : null,
  };
};
