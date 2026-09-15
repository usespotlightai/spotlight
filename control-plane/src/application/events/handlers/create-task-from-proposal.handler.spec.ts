import { CreateTaskFromProposal } from '@application/events/handlers/create-task-from-proposal.handler';
import type { ClockPort } from '@application/ports/clock.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { RaiseTask } from '@application/services/raise-task';
import { Chat } from '@domain/aggregates/chat.aggregate';
import { Line } from '@domain/aggregates/line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import { ProposalAccepted } from '@domain/events/proposal-accepted.event';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { MessagePosition } from '@domain/value-objects/message-position.vo';
import { ProposalPlacement } from '@domain/value-objects/proposal-placement.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-14T09:00:00.000Z');
const LEON = UserId.of('user_1');
const SECOND = MessagePosition.of(1);
const PLACED = ProposalPlacement.rehydrate({
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
});

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

const accepted = () =>
  Chat.start({
    id: 'chat_1',
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: LEON,
    harness: HarnessId.of('claude-code'),
    body: 'Plan the retries.',
    now: NOW,
  })
    .handedTo(RunId.of('run_1'), NOW)
    .proposed({
      runId: RunId.of('run_1'),
      placement: PLACED,
      title: TaskTitle.of('Back off exponentially'),
      description: null,
      at: NOW,
    })
    .accept(SECOND, LEON, NOW);

const event = new ProposalAccepted(
  accepted().id,
  WorkspaceId.of('ws_1'),
  SECOND,
  PLACED,
  TaskTitle.of('Back off exponentially'),
  null,
  LEON,
);

const creating = (line: Line | null) => {
  const save = vi.fn(async (_saved: Chat) => undefined);
  const raise = vi.fn(async ({ task }: { task: Task }) => task);
  const handler = new CreateTaskFromProposal(
    { find: vi.fn(async () => accepted()), save } as unknown as ChatRepository,
    { find: vi.fn(async () => line) } as unknown as LineRepository,
    { placementsAt: vi.fn(async () => []) } as unknown as TaskRepository,
    { raise } as unknown as RaiseTask,
    { generate: () => 'task_9' } as IdGeneratorPort,
    { now: () => NOW } as ClockPort,
  );

  return { handler, save, raise };
};

describe('CreateTaskFromProposal', () => {
  it('raises the accepted task at its station, raised by whoever accepted it, and remembers it on the chat', async () => {
    const { handler, save, raise } = creating(LINE);

    await handler.onProposalAccepted(event);

    const task = raise.mock.calls[0]?.[0].task;
    expect(task?.stationId.value).toBe('station_1');
    expect(task?.title.value).toBe('Back off exponentially');
    expect(task?.raisedBy?.equals(LEON)).toBe(true);
    expect(save.mock.calls[0]?.[0].proposalAt(SECOND).state).toBe('created');
    expect(save.mock.calls[0]?.[0].proposalAt(SECOND).taskId?.value).toBe(
      'task_9',
    );
  });

  it('opens the proposal again where its line is gone', async () => {
    const { handler, save, raise } = creating(null);

    await handler.onProposalAccepted(event);

    expect(raise).not.toHaveBeenCalled();
    expect(save.mock.calls[0]?.[0].proposalAt(SECOND).isOpen).toBe(true);
  });
});
