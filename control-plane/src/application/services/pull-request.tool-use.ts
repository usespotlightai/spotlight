import type { ToolContext } from '@application/ports/integration-tools.port';
import type { BuiltInToolUse } from '@application/services/built-in-tools.service';
import type { OpenPullRequest } from '@application/services/open-pull-request.service';
import { PULL_REQUEST } from '@domain/services/built-in-tools';
import type { ToolInputs } from '@domain/value-objects/tool-inputs.vo';

export class PullRequestToolUse implements BuiltInToolUse {
  readonly tool = PULL_REQUEST;

  constructor(private readonly opening: OpenPullRequest) {}

  async call(
    { task, line }: ToolContext,
    inputs: ToolInputs,
  ): Promise<unknown> {
    const opened = await this.opening.open(task, line, {
      title: (inputs.text('title') ?? '').trim(),
      body: inputs.text('body') ?? '',
      repository: inputs.text('repository')?.trim() ?? null,
    });

    return opened.url;
  }
}
