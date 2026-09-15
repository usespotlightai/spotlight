import type { TaskToolContext } from '@application/ports/integration-tools.port';
import type { OpenPullRequest } from '@application/services/open-pull-request.service';
import { PullRequestToolUse } from '@application/services/pull-request.tool-use';
import { InvalidToolInputError } from '@domain/exceptions/invalid-tool-input.error';
import { builtInTool, PULL_REQUEST } from '@domain/services/built-in-tools';
import { ToolInputs } from '@domain/value-objects/tool-inputs.vo';
import { describe, expect, it } from 'vitest';

type PullRequestAsked = Parameters<OpenPullRequest['open']>[2];

const CONTEXT = {
  kind: 'task',
  run: { id: 'run_1' },
  task: { id: 'task_1' },
  line: { id: 'line_1' },
} as unknown as TaskToolContext;

const using = () => {
  const asked: { task: unknown; line: unknown; asked: PullRequestAsked }[] = [];
  const opening = {
    open: async (task: unknown, line: unknown, wanted: PullRequestAsked) => {
      asked.push({ task, line, asked: wanted });
      return { url: 'https://github.com/acme/widgets/pull/7' };
    },
  } as unknown as OpenPullRequest;

  return { asked, tool: new PullRequestToolUse(opening) };
};

const DECLARED = builtInTool(PULL_REQUEST)?.declared;

describe('PullRequestToolUse', () => {
  it('is the pull-request tool', () => {
    expect(using().tool.tool.value).toBe('pull-request');
  });

  it('opens one for the task, from what the agent handed over, and answers with where it is', async () => {
    const { tool, asked } = using();

    await expect(
      tool.call(
        CONTEXT,
        ToolInputs.of({
          title: '  Fix the queue ',
          body: 'What it does.',
          repository: ' api ',
        }),
      ),
    ).resolves.toBe('https://github.com/acme/widgets/pull/7');

    expect(asked).toEqual([
      {
        task: CONTEXT.task,
        line: CONTEXT.line,
        asked: {
          title: 'Fix the queue',
          body: 'What it does.',
          repository: 'api',
        },
      },
    ]);
  });

  it('names no repository where the agent named none', async () => {
    const { tool, asked } = using();

    await tool.call(CONTEXT, ToolInputs.of({ title: 'Fix the queue' }));

    expect(asked[0]?.asked).toEqual({
      title: 'Fix the queue',
      body: '',
      repository: null,
    });
  });

  it('takes nothing without something to call it', () => {
    expect(() => DECLARED?.accept({ body: 'x' })).toThrow(
      InvalidToolInputError,
    );
    expect(() => DECLARED?.accept({ title: '  ' })).toThrow(/needs title/);
  });
});
