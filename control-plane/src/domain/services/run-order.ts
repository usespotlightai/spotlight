import type { Line } from '@domain/aggregates/line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { Harness } from '@domain/entities/harness.entity';
import type { Skill } from '@domain/entities/skill.entity';
import type { HarnessRepository } from '@domain/repositories/harness.repository';
import { type GivenToRun, givenAt } from '@domain/services/given-to-run';
import type { Continuity } from '@domain/value-objects/continuity.vo';
import type { Effort } from '@domain/value-objects/effort.vo';
import type { HarnessModel } from '@domain/value-objects/harness-model.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import { RunPriority } from '@domain/value-objects/run-priority.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';

export interface RunOrder {
  readonly harness: Harness;
  readonly model: HarnessModel | null;
  readonly effort: Effort | null;
  readonly stationId: StationId;
  readonly priority: RunPriority;
  readonly pinnedTo: RunnerId | null;
  readonly options: readonly string[];
  readonly noteLimit: number;
  readonly continuity: Continuity;
  readonly repositories: readonly Repository[];
  readonly branch: string;
  readonly given: GivenToRun;
}

export const orderFor = ({
  task,
  line,
  harnesses,
  ready,
}: {
  task: Task;
  line: Line;
  harnesses: HarnessRepository;
  ready: readonly Skill[];
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
    options: line.optionsFrom(station.id).map((each) => each.word),
    noteLimit: 0,
    continuity,
    repositories: line.repositories.all,
    branch: task.branch.value,
    given: givenAt(station, ready),
  };
};
