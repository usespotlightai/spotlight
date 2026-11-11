import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DeleteTaskDraft } from '@work/application/events/handlers/delete-task-draft.handler';
import { DeleteTaskInboxRequests } from '@work/application/events/handlers/delete-task-inbox-requests.handler';
import type { TaskDraftStatesPort } from '@work/application/ports/task-draft-states.port';
import type { InboxRequest } from '@work/domain/aggregates/inbox-request.aggregate';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import type { InboxRequestRepository } from '@work/domain/repositories/inbox-request.repository';
import { describe, expect, it, vi } from 'vitest';

const TASK = TaskId.of('task_1');
const deleted = new TaskDeleted(TASK, WorkspaceId.of('ws_1'));

describe('a deleted task’s inbox requests', () => {
  it('are each removed as they were read', async () => {
    const requests = ['one', 'two'].map(
      (id) => ({ id }) as unknown as InboxRequest,
    );
    const remove = vi.fn<(inboxRequest: InboxRequest) => Promise<void>>(
      async () => {},
    );
    const ofTask = vi.fn(async () => requests);

    await new DeleteTaskInboxRequests({
      ofTask,
      remove,
    } as unknown as InboxRequestRepository).on(deleted);

    expect(ofTask).toHaveBeenCalledWith(TASK);
    expect(remove.mock.calls.map(([each]) => each)).toEqual(requests);
  });
});

describe('a deleted task’s shared draft', () => {
  it('forgets what its editors kept', async () => {
    const forget = vi.fn<(taskId: TaskId) => Promise<void>>(async () => {});

    await new DeleteTaskDraft({
      forget,
    } as unknown as TaskDraftStatesPort).on(deleted);

    expect(forget).toHaveBeenCalledWith(TASK);
  });
});
