import type { ReplayAnswer } from '@work/application/ports/replay-dispatch.port';
import type { RunEvidencePort } from '@work/application/ports/run-evidence.port';
import { Answered } from '@work/application/rendering/answered';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { feedbackAfter } from '@work/domain/services/feedback-after';

export class ReplayAnswers {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly evidence: RunEvidencePort,
  ) {}

  async has(original: Run, answer: ReplayAnswer): Promise<boolean> {
    if (answer === 'accepted') {
      const evidenced = await this.evidence.of(original.id.value);

      return Answered.acceptedGiven(evidenced?.hunks ?? []);
    }

    const task = original.taskId && (await this.tasks.find(original.taskId));

    return Boolean(
      task && Answered.sentBackGiven(feedbackAfter(task.notes, original.id)),
    );
  }

  async briefFor(original: Run, answer: ReplayAnswer): Promise<string | null> {
    if (answer === 'accepted') {
      const evidenced = await this.evidence.of(original.id.value);

      return Answered.accepted(evidenced?.hunks ?? []);
    }

    const task = original.taskId && (await this.tasks.find(original.taskId));

    return task
      ? Answered.sentBack(feedbackAfter(task.notes, original.id))
      : null;
  }
}
