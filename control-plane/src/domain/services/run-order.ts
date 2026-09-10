import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { Harness } from '@domain/entities/harness.entity';
import type { HarnessRepository } from '@domain/repositories/harness.repository';
import type { Continuity } from '@domain/value-objects/continuity.vo';
import type { Effort } from '@domain/value-objects/effort.vo';
import type { HarnessModel } from '@domain/value-objects/harness-model.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import { RunPriority } from '@domain/value-objects/run-priority.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';

/** What a run is for. How it is written down for a runner is not this. */
export interface RunOrder {
  readonly harness: Harness;
  /** Which model answers here, or null to let the harness's own default. */
  readonly model: HarnessModel | null;
  /** How hard to think here, or null to let the harness's own default. */
  readonly effort: Effort | null;
  readonly stationId: StationId;
  readonly priority: RunPriority;
  readonly pinnedTo: RunnerId | null;
  readonly options: readonly string[];
  readonly noteLimit: number;
  readonly continuity: Continuity;
  readonly repositories: readonly Repository[];
  readonly branch: string;
  /** What this run may reach for, named so the runner knows what to raise. */
  readonly tools: readonly string[];
}

/** Queueing what nothing can start strands the task on the queue, where
 *  nobody sees it, rather than at the station, where they do. */
export const orderFor = ({
  task,
  line,
  harnesses,
}: {
  task: Task;
  line: AssemblyLine;
  harnesses: HarnessRepository;
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
    // Whatever the station named, or none: an unset model or effort lets the
    // harness answer with its own default rather than one Spotlight imposed.
    model: station.model,
    effort: station.effort,
    stationId: station.id,
    priority: RunPriority.of(line.depthOf(station.id)),
    pinnedTo: continuity.pinnedTo,
    options: line.optionsFrom(station.id).map((each) => each.value),
    noteLimit: 0,
    continuity,
    repositories: line.repositories.all,
    branch: task.branch.value,
    tools: station.tools.map((each) => each.value),
  };
};
