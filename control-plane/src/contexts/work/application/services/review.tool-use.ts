import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { PullRequestReviewingPort } from '@work/application/ports/pull-request-reviewing.port';
import type { BuiltInToolUse } from '@work/application/services/built-in-tools.service';
import { REVIEW } from '@work/domain/services/built-in-tools';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export class ReviewToolUse implements BuiltInToolUse<TaskToolContext> {
  readonly tool = REVIEW;

  constructor(private readonly reviewing: PullRequestReviewingPort) {}

  async call(context: TaskToolContext, inputs: ToolInputs): Promise<unknown> {
    const review = await this.reviewing.submit(
      { runId: context.runId, taskId: context.taskId },
      {
        verdict: inputs.text('verdict')?.trim() || 'comment',
        body: inputs.text('body') ?? '',
      },
    );

    return { review };
  }
}
