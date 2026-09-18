import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { OpenPullRequest } from '@work/application/services/open-pull-request.service';
import { PullRequestToolUse } from '@work/application/services/pull-request.tool-use';
import { InvalidToolInputError } from '@work/domain/exceptions/invalid-tool-input.error';
import {
  builtInTool,
  PULL_REQUEST,
} from '@work/domain/services/built-in-tools';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it } from 'vitest';

type PullRequestFor = Parameters<OpenPullRequest['open']>[0];
type PullRequestAsked = Parameters<OpenPullRequest['open']>[1];

const CONTEXT: TaskToolContext = {
  kind: 'task',
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TaskId.of('task_1'),
  stationId: StationId.of('station_1'),
};

const using = () => {
  const asked: { target: PullRequestFor; asked: PullRequestAsked }[] = [];
  const opening = {
    open: async (target: PullRequestFor, wanted: PullRequestAsked) => {
      asked.push({ target, asked: wanted });
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
        target: {
          runId: CONTEXT.runId,
          taskId: CONTEXT.taskId,
          stationId: CONTEXT.stationId,
        },
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
