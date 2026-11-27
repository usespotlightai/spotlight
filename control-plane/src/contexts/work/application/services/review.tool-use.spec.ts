import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type {
  PullRequestReviewingPort,
  SubmittedVerdict,
} from '@work/application/ports/pull-request-reviewing.port';
import { ReviewToolUse } from '@work/application/services/review.tool-use';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it } from 'vitest';

const CONTEXT: TaskToolContext = {
  kind: 'task',
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TaskId.of('task_1'),
  stationId: StationId.of('station_1'),
  requester: null,
};

const using = () => {
  const submitted: SubmittedVerdict[] = [];
  const reviewing = {
    comment: async () => 'comment_1',
    submit: async (_on, review) => {
      submitted.push(review);
      return 'review_1';
    },
  } satisfies PullRequestReviewingPort;

  return { submitted, tool: new ReviewToolUse(reviewing) };
};

describe('ReviewToolUse', () => {
  it('submits the verdict and the summary the agent wrote', async () => {
    const { tool, submitted } = using();

    await expect(
      tool.call(
        CONTEXT,
        ToolInputs.of({ verdict: 'approve', body: 'Looks right.' }),
      ),
    ).resolves.toEqual({ review: 'review_1' });
    expect(submitted).toEqual([{ verdict: 'approve', body: 'Looks right.' }]);
  });

  it('submits no summary where the agent wrote none', async () => {
    const { tool, submitted } = using();

    await tool.call(CONTEXT, ToolInputs.of({ verdict: 'comment' }));

    expect(submitted).toEqual([{ verdict: 'comment', body: null }]);
  });
});
