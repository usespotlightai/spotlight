import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { TaskBriefing } from '@domain/services/task-briefing';
import { harnessNamed } from '@domain/value-objects/built-in-harnesses';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import {
  type RunSpecShape,
  THROUGH_SPOTLIGHT,
} from '@domain/value-objects/run-spec.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import { TASK_NOTE_MAX_LENGTH } from '@domain/value-objects/task-note-body.vo';

export interface RunOrder {
  readonly harness: HarnessId;
  readonly stationId: StationId;
  readonly priority: number;
  readonly pinnedTo: RunnerId | null;
  readonly spec: RunSpecShape;
}

/** Queueing what nothing can start strands the task on the queue, where
 *  nobody sees it, rather than at the station, where they do. */
export const orderFor = ({
  task,
  line,
}: {
  task: Task;
  line: AssemblyLine;
}): RunOrder | null => {
  const station = line.stationAt(task.stationId);

  if (!station?.harness) {
    return null;
  }

  const harness = harnessNamed(station.harness);

  if (!harness) {
    return null;
  }

  const continuity = task.continuity();

  return {
    harness: harness.id,
    stationId: station.id,
    priority: station.position,
    pinnedTo: continuity.pinnedTo,
    spec: {
      checkouts: task.repository
        ? [
            {
              remote: THROUGH_SPOTLIGHT,
              path: task.repository.name,
              branch: task.branch,
            },
          ]
        : undefined,
      command: harness.command.started(),
      briefing: TaskBriefing.brief({ task, line }),
      handover: {
        options: line.optionsFrom(station.id),
        noteLimit: TASK_NOTE_MAX_LENGTH,
      },
      continuity: continuity.told(),
    },
  };
};
