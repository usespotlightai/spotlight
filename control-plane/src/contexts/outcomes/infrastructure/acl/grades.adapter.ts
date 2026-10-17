import type { GradesPort } from '@outcomes/application/ports/grades.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskAsidesPort } from '@work/application/ports/task-asides.port';

const FORM = 'grade';

export class Grades implements GradesPort {
  constructor(private readonly asides: TaskAsidesPort) {}

  ask(taskId: TaskId, runId: RunId): Promise<void> {
    return this.asides.raise({ taskId, form: FORM, about: runId.value });
  }

  resolve(taskId: TaskId, runId: RunId): Promise<void> {
    return this.asides.resolve({ taskId, form: FORM, about: runId.value });
  }
}
