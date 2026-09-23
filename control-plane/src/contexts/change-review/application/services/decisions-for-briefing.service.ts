import type { DecisionReaderPort } from '@change-review/application/ports/decision-reader.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type {
  BriefedDecision,
  TaskDecisionsPort,
} from '@work/application/ports/task-decisions.port';

export class DecisionsForBriefing implements TaskDecisionsPort {
  constructor(private readonly decisions: DecisionReaderPort) {}

  async ofTask(taskId: TaskId): Promise<readonly BriefedDecision[]> {
    const found = await this.decisions.ofTask(taskId);

    return (found?.decisions ?? []).map((each) => ({
      kind: each.kind,
      title: each.title,
      why: each.why,
      paths: each.paths,
      disputes: each.disputes.map((dispute) => dispute.reason),
    }));
  }
}
