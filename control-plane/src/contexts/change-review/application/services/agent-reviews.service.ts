import type {
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import type { SubmitReview } from '@change-review/application/services/submit-review.service';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { assertAgentMayReview } from '@change-review/domain/services/agent-review-target';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type {
  LeftComment,
  PullRequestReviewingPort,
  ReviewingRun,
  SubmittedVerdict,
} from '@work/application/ports/pull-request-reviewing.port';

export class AgentReviews implements PullRequestReviewingPort {
  constructor(
    private readonly work: WorkPort,
    private readonly comments: ReviewCommentRepository,
    private readonly submitting: SubmitReview,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async comment(on: ReviewingRun, left: LeftComment): Promise<string> {
    const task = await this.reviewed(on);
    const draft = ReviewComment.draft({
      id: ReviewCommentId.of(this.ids.generate()),
      workspaceId: task.workspaceId,
      taskId: task.id,
      anchor: ReviewAnchor.onLines({
        path: left.path,
        side: left.side,
        line: left.line,
        startLine: left.startLine,
      }),
      body: left.body,
      author: ReviewAuthor.agent(on.runId),
      now: this.clock.now(),
    });

    await this.comments.add(draft);

    return draft.id.value;
  }

  async submit(on: ReviewingRun, verdict: SubmittedVerdict): Promise<string> {
    return (
      await this.submitting.submit({
        task: await this.reviewed(on),
        author: ReviewAuthor.agent(on.runId),
        verdict: verdict.verdict,
        body: verdict.body ?? '',
      })
    ).value;
  }

  private async reviewed(on: ReviewingRun): Promise<ReviewedTask> {
    const task = await this.work.task(on.taskId);

    assertAgentMayReview(task);

    return task;
  }
}
