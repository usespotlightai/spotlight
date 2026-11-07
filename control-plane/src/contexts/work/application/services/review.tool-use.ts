import type { BuiltInToolUse } from '@work/application/ports/built-in-tool-uses.port';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { PullRequestReviewingPort } from '@work/application/ports/pull-request-reviewing.port';
import { REVIEW } from '@work/domain/services/built-in-tools';
import { ReviewVerdict } from '@work/domain/value-objects/review-verdict.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export class ReviewToolUse implements BuiltInToolUse<TaskToolContext> {
  readonly tool = REVIEW;

  constructor(private readonly reviewing: PullRequestReviewingPort) {}

  async call(context: TaskToolContext, inputs: ToolInputs): Promise<unknown> {
    const review = await this.reviewing.submit(
      { runId: context.runId, taskId: context.taskId },
      {
        verdict: ReviewVerdict.fromInput(inputs.text('verdict')).value,
        body: inputs.text('body'),
      },
    );

    return { review };
  }
}
