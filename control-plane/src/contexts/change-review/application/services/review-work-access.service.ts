import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  ReviewWorkAccessPort,
  LeasedReviewWork,
} from '@work/application/ports/review-work-access.port';

export class ReviewWorkAccess implements ReviewWorkAccessPort {
  constructor(
    private readonly checks: StackCheckRepository,
    private readonly stacks: ChangeStackReaderPort,
    private readonly diffs: PushDiffRepository,
  ) {}

  async leasedWork(
    work: { readonly kind: 'check' | 'diff'; readonly id: string },
    runner: RunnerId,
    now: Date,
  ): Promise<LeasedReviewWork | null> {
    if (work.kind === 'check') {
      const stackId = ChangeStackId.of(work.id);
      const check = (await this.checks.ofStack(stackId)).find((each) =>
        each.beingCheckedBy(runner, now),
      );
      const stack = check ? await this.stacks.repositoryOf(stackId) : null;

      return check && stack
        ? {
            runId: check.runId,
            taskId: check.taskId,
            repository: stack.repository,
          }
        : null;
    }

    const diff = await this.diffs.find(PushDiffId.of(work.id));

    return diff?.beingDiffedBy(runner, now) === true
      ? { runId: null, taskId: diff.taskId, repository: diff.repository.value }
      : null;
  }
}
