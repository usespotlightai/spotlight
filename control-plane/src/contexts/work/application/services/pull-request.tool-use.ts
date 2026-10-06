import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { BuiltInToolUse } from '@work/application/services/built-in-tools.service';
import type { OpenPullRequest } from '@work/application/services/open-pull-request.service';
import { PULL_REQUEST } from '@work/domain/services/built-in-tools';
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
        title: (inputs.text('title') ?? '').trim(),
        body: inputs.text('body') ?? '',
        repository: inputs.text('repository')?.trim() ?? null,
      },
    );

    return { url: opened.url };
  }
}
