import type { BuiltInToolUse } from '@work/application/ports/built-in-tool-uses.port';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { OpenPullRequest } from '@work/application/services/open-pull-request.service';
import { PULL_REQUEST } from '@work/domain/value-objects/built-in-tools';
import { PullRequestTitle } from '@work/domain/value-objects/pull-request-title.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export class PullRequestToolUse implements BuiltInToolUse<TaskToolContext> {
  readonly tool = PULL_REQUEST;

  constructor(private readonly opening: OpenPullRequest) {}

  async call(
    { runId, taskId, stationId }: TaskToolContext,
    inputs: ToolInputs,
  ): Promise<unknown> {
    const opened = await this.opening.open(
      { runId, taskId, stationId },
      {
        title: PullRequestTitle.of(inputs.requiredText(this.tool, 'title')),
        body: inputs.text('body') ?? null,
        repository: inputs.text('repository')?.trim() ?? null,
      },
    );

    return { url: opened.url };
  }
}
