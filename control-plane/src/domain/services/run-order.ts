import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { Harness } from '@domain/entities/harness.entity';
import type { HarnessRepository } from '@domain/repositories/harness.repository';
import type { Continuity } from '@domain/value-objects/continuity.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import { TASK_NOTE_MAX_LENGTH } from '@domain/value-objects/task-note-body.vo';

/** What a run is for. How it is written down for a runner is not this. */
export interface RunOrder {
  readonly harness: Harness;
  readonly stationId: StationId;
  readonly priority: number;
  readonly pinnedTo: RunnerId | null;
  readonly options: readonly string[];
  readonly noteLimit: number;
  readonly continuity: Continuity;
  readonly repository: Repository | null;
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
    stationId: station.id,
    priority: station.position,
    pinnedTo: continuity.pinnedTo,
    options: line.optionsFrom(station.id).map((each) => each.value),
    noteLimit: TASK_NOTE_MAX_LENGTH,
    continuity,
    repository: task.repository,
    branch: task.branch.value,
    tools: station.tools.map((each) => each.value),
  };
};
