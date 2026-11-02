import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import { AttachmentCopies } from '@work/application/services/attachment-copies';
import { ProposeTaskToolUse } from '@work/application/services/propose-task.tool-use';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskProposed } from '@work/domain/events/task-proposed.event';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import { InvalidChatTransitionError } from '@work/domain/exceptions/invalid-chat-transition.error';
import { NowhereToProposeError } from '@work/domain/exceptions/nowhere-to-propose.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-14T09:00:00.000Z');

const MOCKUP = Attachment.of({
  id: 'att_mockup',
  name: 'mockup.png',
  contentType: 'image/png',
  size: 1024,
});

const LINE = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    Station.of({
      id: StationId.of('station_1'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: StationColor.of('#a3a8b0'),
      kind: 'backlog',
    }),
    Station.of({
      id: StationId.of('station_2'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 1,
      color: StationColor.of('#a3a8b0'),
      kind: 'completed',
    }),
  ],
});

const using = () => {
  const chat = Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.of('Plan the retries.'),
    attachments: [MOCKUP],
    now: NOW,
    newId: () => 'chat_1',
  }).assignRun(RunId.of('run_1'), NOW);
  chat.pullEvents();

  const dispatch = vi.fn(async (_events: readonly unknown[]) => undefined);
  const save = vi.fn(async (saved: Chat) => {
    await dispatch(saved.pullEvents());
  });
  const copy = vi.fn(async () => undefined);
  const tool = new ProposeTaskToolUse(
    { find: async () => chat, save } as unknown as ChatRepository,
    { ofTeam: async () => [LINE] } as unknown as LineRepository,
    new AttachmentCopies({ copy } as unknown as AttachmentStorePort),
    { now: () => NOW } as ClockPort,
  );
  const context: ChatToolContext = {
    kind: 'chat',
    runId: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    chatId: chat.id,
    teamId: TeamId.of('team_1'),
    requester: null,
  };

  return { tool, context, save, dispatch, copy };
};

describe('ProposeTaskToolUse', () => {
  it('is the propose-task tool', () => {
    expect(using().tool.tool.value).toBe('propose-task');
  });

  it('keeps a proposal in the chat for the person to decide on, and says it was proposed', async () => {
    const { tool, context, save, dispatch } = using();

    const answer = await tool.call(
      context,
      ToolInputs.of({
        line: 'delivery',
        station: 'backlog',
        title: 'Back off exponentially',
        description: 'Double the wait each time.',
      }),
    );

    const proposal = save.mock.calls[0]?.[0].proposalAt(MessagePosition.of(1));
    expect(proposal?.placement.stationId.value).toBe('station_1');
    expect(proposal?.description?.value).toBe('Double the wait each time.');
    expect(dispatch.mock.calls[0]?.[0]).toEqual([expect.any(TaskProposed)]);
    expect(answer).toEqual({
      proposed: 'Back off exponentially',
      line: 'delivery',
      station: 'backlog',
      next: expect.stringContaining('The person decides'),
    });
  });

  it('puts a copy of each file named on the proposal, from the path the run sees', async () => {
    const { tool, context, save, copy } = using();

    await tool.call(
      context,
      ToolInputs.of({
        line: 'delivery',
        station: 'backlog',
        title: 'Match the mockup',
        attach: ['/workspace/.spotlight/attachments/att_mockup/mockup.png'],
      }),
    );

    const [given] = save.mock.calls[0]?.[0].messages[1]?.attachments ?? [];
    expect(given?.id.value).toBe('chat_1-1-0');
    expect(given?.name).toBe('mockup.png');
    expect(copy).toHaveBeenCalledWith(WorkspaceId.of('ws_1'), MOCKUP, given);
  });

  it('copies nothing for a run that no longer works the chat', async () => {
    const { tool, context, save, copy } = using();

    await expect(
      tool.call(
        { ...context, runId: RunId.of('run_old') },
        ToolInputs.of({
          line: 'delivery',
          station: 'backlog',
          title: 'Match the mockup',
          attach: ['att_mockup'],
        }),
      ),
    ).rejects.toThrow(InvalidChatTransitionError);
    expect(copy).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('proposes nothing with a file that is not attached to the chat', async () => {
    const { tool, context, save, copy } = using();

    await expect(
      tool.call(
        context,
        ToolInputs.of({
          line: 'delivery',
          station: 'backlog',
          title: 'Match the mockup',
          attach: ['att_elsewhere'],
        }),
      ),
    ).rejects.toThrow(InvalidAttachmentError);
    expect(copy).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('proposes nothing where the line or station is not one of the team’s', async () => {
    const { tool, context, save } = using();

    await expect(
      tool.call(
        context,
        ToolInputs.of({
          line: 'nowhere',
          station: 'backlog',
          title: 'Back off',
        }),
      ),
    ).rejects.toThrow(NowhereToProposeError);
    expect(save).not.toHaveBeenCalled();
  });
});
