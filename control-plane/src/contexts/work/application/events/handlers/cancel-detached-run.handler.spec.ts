import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { CancelDetachedRun } from '@work/application/events/handlers/cancel-detached-run.handler';
import { recordingRuns } from '@work/application/ports/runs.fake-spec';
import { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');

const detached = new TaskRunDetached(
  TaskId.of('task_1'),
  WorkspaceId.of('ws_1'),
  RUN,
);

const deletedChat = (runId: RunId | null) =>
  new ChatDeleted(
    ChatId.of('chat_1'),
    WorkspaceId.of('ws_1'),
    TeamId.of('team_1'),
    runId,
  );

const cancelling = () => {
  const runs = recordingRuns();

  return { handler: new CancelDetachedRun(runs), runs };
};

describe('CancelDetachedRun', () => {
  it('cancels the run that its task detached, saying why', async () => {
    const { handler, runs } = cancelling();

    await handler.on(detached);

    expect(runs.cancel).toHaveBeenCalledWith(
      RUN,
      'Task moved on before a runner claimed the run.',
    );
  });

  it('cancels the run of a chat that was deleted, and nothing for a chat with no run', async () => {
    const { handler, runs } = cancelling();

    await handler.onChatDeleted(deletedChat(null));
    expect(runs.cancel).not.toHaveBeenCalled();

    await handler.onChatDeleted(deletedChat(RUN));
    expect(runs.cancel).toHaveBeenCalledWith(
      RUN,
      'Chat was deleted before a runner claimed the run.',
    );
  });
});
