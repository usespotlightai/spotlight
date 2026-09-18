import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { PullRequestReviewingPort } from '@work/application/ports/pull-request-reviewing.port';
import type { BuiltInToolUse } from '@work/application/services/built-in-tools.service';
import { REVIEW_COMMENT } from '@work/domain/services/built-in-tools';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export class ReviewCommentToolUse implements BuiltInToolUse<TaskToolContext> {
  readonly tool = REVIEW_COMMENT;

  constructor(private readonly reviewing: PullRequestReviewingPort) {}

  async call(context: TaskToolContext, inputs: ToolInputs): Promise<unknown> {
    const comment = await this.reviewing.comment(
      { runId: context.runId, taskId: context.taskId },
      {
        path: inputs.text('path') ?? '',
        line: inputs.number('line') ?? 0,
        startLine: inputs.number('start-line'),
        side: inputs.text('side')?.trim() || 'new',
        body: inputs.text('body') ?? '',
      },
    );

    return { comment };
  }
}
