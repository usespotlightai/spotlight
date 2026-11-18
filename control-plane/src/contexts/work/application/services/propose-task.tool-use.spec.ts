import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { AttachmentCopies } from '@work/application/services/attachment-copies';
import { ProposeTaskToolUse } from '@work/application/services/propose-task.tool-use';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatVersionConflictError } from '@work/domain/exceptions/chat-version-conflict.error';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import { InvalidChatTransitionError } from '@work/domain/exceptions/invalid-chat-transition.error';
import { InvalidToolInputError } from '@work/domain/exceptions/invalid-tool-input.error';
import { NowhereToProposeError } from '@work/domain/exceptions/nowhere-to-propose.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-14T09:00:00.000Z');

const MOCKUP = Attachment.of({
  id: 'att_mockup',
  name: 'mockup.png',
  contentType: 'image/png',
  size: 1024,
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

const using = ({ proposed = false } = {}) => {
  const started = Chat.start({
    lines: [],
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.of('Plan the retries.'),
    attachments: [MOCKUP],
    now: NOW,
    newId: () => 'chat_1',
  }).assignRun(RunId.of('run_1'), NOW);
  const chat = proposed
    ? started.propose({
        runId: RunId.of('run_1'),
        placement: ProposalPlacement.of({
          lineId: LineId.of('line_1'),
          stationId: StationId.of('station_1'),
        }),
        title: TaskTitle.of('Back off exponentially'),
        description: null,
        at: NOW,
      })
    : started;
  chat.pullEvents();

  const dispatch = vi.fn(async (_events: readonly unknown[]) => undefined);
  const save = vi.fn(async (saved: Chat) => {
    await dispatch(saved.pullEvents());
  });
  const copy = vi.fn(async () => undefined);
  const tool = new ProposeTaskToolUse(
    { find: async () => chat, save } as unknown as ChatRepository,
    { ofTeam: async () => [LINE] } as unknown as LineMapsPort,
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
    const { tool, context, save } = using();

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
    expect(answer).toEqual({
      proposed: 'Back off exponentially',
      number: 1,
      line: 'delivery',
      station: 'backlog',
      next: expect.stringContaining('The person decides') as unknown,
    });
  });

  it('proposes again on the chat as it now is when a message changed it meanwhile', async () => {
    const { tool, context, save } = using();
    save.mockRejectedValueOnce(new ChatVersionConflictError('chat_1'));

    const answer = await tool.call(
      context,
      ToolInputs.of({
        line: 'delivery',
        station: 'backlog',
        title: 'Back off exponentially',
      }),
    );

    expect(save).toHaveBeenCalledTimes(2);
    expect(answer).toMatchObject({ proposed: 'Back off exponentially' });
  });

  it('replaces the earlier proposals it names by number, and says so', async () => {
    const { tool, context, save } = using({ proposed: true });

    const answer = await tool.call(
      context,
      ToolInputs.of({
        line: 'delivery',
        station: 'backlog',
        title: 'Back off with jitter',
        replaces: ['1'],
      }),
    );

    const saved = save.mock.calls[0]?.[0];
    expect(saved?.proposalAt(MessagePosition.of(1)).state).toBe('replaced');
    expect(saved?.proposalAt(MessagePosition.of(2)).isOpen).toBe(true);
    expect(answer).toMatchObject({ number: 2, replaced: [1] });
  });

  it('proposes nothing where a replaced proposal is not named by its number', async () => {
    const { tool, context, save } = using({ proposed: true });

    await expect(
      tool.call(
        context,
        ToolInputs.of({
          line: 'delivery',
          station: 'backlog',
          title: 'Back off with jitter',
          replaces: ['the first one'],
        }),
      ),
    ).rejects.toThrow(InvalidToolInputError);
    expect(save).not.toHaveBeenCalled();
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
