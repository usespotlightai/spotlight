import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TracedTaskReaderPort } from '@work/application/ports/traced-task-reader.port';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';

export class TracesAtHand {
  constructor(private readonly tasks: TracedTaskReaderPort) {}

  async shared(taskIds: readonly string[]): Promise<TraceReference[]> {
    const asked = [...new Set(taskIds)];

    TraceReference.refuseTooMany(asked.length);

    const found = await this.tasks.of(asked.map((each) => TaskId.of(each)));

    return asked.map((id) => {
      const traced = found.find((each) => each.taskId === id);

      if (!traced) {
        throw new UnknownTaskError(id);
      }

      return TraceReference.of({
        taskId: TaskId.of(traced.taskId),
        title: TaskTitle.of(traced.title),
        teamId: TeamId.of(traced.teamId),
      });
    });
  }
}
