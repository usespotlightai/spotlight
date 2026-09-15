import type { ClockPort } from '@application/ports/clock.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { ChatToolContext } from '@application/ports/integration-tools.port';
import { ProposeTaskToolUse } from '@application/services/propose-task.tool-use';
import { Chat } from '@domain/aggregates/chat.aggregate';
import { Line } from '@domain/aggregates/line.aggregate';
import { Run } from '@domain/aggregates/run.aggregate';
import { Station } from '@domain/entities/station.entity';
import { TaskProposed } from '@domain/events/task-proposed.event';
import { NowhereToProposeError } from '@domain/exceptions/nowhere-to-propose.error';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import { ChatId } from '@domain/value-objects/chat-id.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { MessagePosition } from '@domain/value-objects/message-position.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { RunSubject } from '@domain/value-objects/run-subject.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { ToolInputs } from '@domain/value-objects/tool-inputs.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-14T09:00:00.000Z');

const LINE = Line.of({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  factoryId: FactoryId.of('factory_1'),
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

const run = Run.enqueue({
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  harness: HarnessId.of('claude-code'),
  subject: RunSubject.chat(ChatId.of('chat_1')),
  spec: RunSpec.of({
    command: { executable: 'claude-agent-acp', args: [] },
    briefing: 'plan',
    handover: { options: [], noteLimit: 0 },
    continuity: { key: 'chat-chat_1', keep: true },
  }),
});

const using = () => {
  const chat = Chat.start({
    id: 'chat_1',
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    body: 'Plan the retries.',
    now: NOW,
  }).handedTo(RunId.of('run_1'), NOW);
  chat.pullEvents();

  const save = vi.fn(async (_saved: Chat) => undefined);
  const dispatch = vi.fn(async (_events: readonly unknown[]) => undefined);
  const tool = new ProposeTaskToolUse(
    { save } as unknown as ChatRepository,
    { dispatch } as unknown as DomainEventDispatcher,
    { now: () => NOW } as ClockPort,
  );
  const context: ChatToolContext = { kind: 'chat', run, chat, lines: [LINE] };

  return { tool, context, save, dispatch };
};

describe('ProposeTaskToolUse', () => {
  it('is the propose-task tool', () => {
    expect(using().tool.tool.value).toBe('propose-task');
  });

  it('holds a proposal in the chat for the person to decide on, and says it was proposed', async () => {
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
    expect(answer).toContain('The person decides');
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
