import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { CreateTaskFromProposal } from '@work/application/events/handlers/create-task-from-proposal.handler';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { AttachmentCopies } from '@work/application/services/attachment-copies';
import type { CreateTask } from '@work/application/services/create-task';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-14T09:00:00.000Z');
const LEON = UserId.of('user_1');
const SECOND = MessagePosition.of(1);
const MOCKUP = Attachment.of({
  id: 'att_mockup',
  name: 'mockup.png',
  contentType: 'image/png',
  size: 1024,
});
const PLACED = ProposalPlacement.of({
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
});

const LINE = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    stationOf({
      id: StationId.of('station_1'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: '#a3a8b0',
      kind: 'backlog',
    }),
    stationOf({
      id: StationId.of('station_2'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 1,
      color: '#a3a8b0',
      kind: 'completed',
    }),
  ],
});

const accepted = () =>
  Chat.start({
    lines: [],
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: LEON,
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.of('Plan the retries.'),
    now: NOW,
    newId: () => 'chat_1',
  })
    .assignRun(RunId.of('run_1'), NOW)
    .propose({
      runId: RunId.of('run_1'),
      placement: PLACED,
      title: TaskTitle.of('Back off exponentially'),
      description: null,
      at: NOW,
    })
    .accept(SECOND, LEON, NOW);

const acceptedWith = (attachments: readonly Attachment[]) =>
  new ProposalAccepted(
    accepted().id,
    WorkspaceId.of('ws_1'),
    SECOND,
    PLACED,
    TaskTitle.of('Back off exponentially'),
    null,
    attachments,
    LEON,
  );

const event = acceptedWith([]);

const creating = (line: LineMap | null) => {
  const save = vi.fn(async (_saved: Chat) => undefined);
  const create = vi.fn(async ({ task }: { task: Task }) => task);
  const copy = vi.fn(async () => undefined);
  const handler = new CreateTaskFromProposal(
    { find: vi.fn(async () => accepted()), save } as unknown as ChatRepository,
    { find: vi.fn(async () => line) } as unknown as LineMapsPort,
    { placementsAt: vi.fn(async () => []) },
    { create } as unknown as CreateTask,
    new AttachmentCopies({ copy } as unknown as AttachmentStorePort),
    { generate: () => 'task_9' } as IdGeneratorPort,
    { now: () => NOW } as ClockPort,
  );

  return { handler, save, create, copy };
};

describe('CreateTaskFromProposal', () => {
  it('creates the accepted task at its station, created by whoever accepted it, and remembers it on the chat', async () => {
    const { handler, save, create } = creating(LINE);

    await handler.onProposalAccepted(event);

    const task = create.mock.calls[0]?.[0].task;
    expect(task?.stationId.value).toBe('station_1');
    expect(task?.title.value).toBe('Back off exponentially');
    expect(task?.createdBy?.equals(LEON)).toBe(true);
    expect(save).not.toHaveBeenCalled();
    const [opened] = task?.pullEvents() ?? [];
    expect(opened).toBeInstanceOf(TaskOpened);
    expect(
      (opened as TaskOpened).proposedIn?.equals(
        ProposalOrigin.of({ chatId: ChatId.of('chat_1'), position: SECOND }),
      ),
    ).toBe(true);
  });

  it('gives the task its own copy of each file on the proposal', async () => {
    const { handler, create, copy } = creating(LINE);

    await handler.onProposalAccepted(acceptedWith([MOCKUP]));

    const [given] = create.mock.calls[0]?.[0].task.attachments ?? [];
    expect(given?.id.value).toBe('chat_1-1-task-0');
    expect(given?.name).toBe('mockup.png');
    expect(copy).toHaveBeenCalledWith(WorkspaceId.of('ws_1'), MOCKUP, given);
  });

  it('remembers on the chat the task its proposal became, once the task is opened', async () => {
    const { handler, save } = creating(LINE);

    await handler.onTaskOpened(
      new TaskOpened(
        TaskId.of('task_9'),
        WorkspaceId.of('ws_1'),
        TeamId.of('team_1'),
        LineId.of('line_1'),
        StationId.of('station_1'),
        null,
        new Date(),
        false,
        ProposalOrigin.of({ chatId: ChatId.of('chat_1'), position: SECOND }),
      ),
    );

    expect(save.mock.calls[0]?.[0].proposalAt(SECOND).state).toBe('created');
    expect(save.mock.calls[0]?.[0].proposalAt(SECOND).taskId?.value).toBe(
      'task_9',
    );
  });

  it('leaves chats alone when a task opens that no chat proposed', async () => {
    const { handler, save } = creating(LINE);

    await handler.onTaskOpened(
      new TaskOpened(
        TaskId.of('task_9'),
        WorkspaceId.of('ws_1'),
        TeamId.of('team_1'),
        LineId.of('line_1'),
        StationId.of('station_1'),
        null,
        new Date(),
        false,
      ),
    );

    expect(save).not.toHaveBeenCalled();
  });

  it('opens the proposal again where its line is gone', async () => {
    const { handler, save, create } = creating(null);

    await handler.onProposalAccepted(event);

    expect(create).not.toHaveBeenCalled();
    expect(save.mock.calls[0]?.[0].proposalAt(SECOND).isOpen).toBe(true);
  });
});
