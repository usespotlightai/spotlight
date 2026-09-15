import type { ClockPort } from '@application/ports/clock.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { ProposalAcceptances } from '@application/services/proposal-acceptances';
import type { RaiseTask } from '@application/services/raise-task';
import { Task } from '@domain/aggregates/task.aggregate';
import type { ProposalAccepted } from '@domain/events/proposal-accepted.event';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { Placement } from '@domain/services/placement';

export class CreateTaskFromProposal implements ProposalAcceptances {
  constructor(
    private readonly chats: ChatRepository,
    private readonly lines: LineRepository,
    private readonly tasks: TaskRepository,
    private readonly raise: RaiseTask,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async onProposalAccepted(event: ProposalAccepted): Promise<void> {
    const chat = await this.chats.find(event.chatId);

    if (!chat) {
      return;
    }

    const line = await this.lines.find(event.placement.lineId);
    const station = line?.stationAt(event.placement.stationId);

    if (!line || !station || !line.workspaceId.equals(event.workspaceId)) {
      await this.chats.save(chat.acceptanceFailed(event.position));
      return;
    }

    const task = Task.add({
      workspaceId: line.workspaceId,
      stationId: station.id,
      title: event.title,
      description: event.description,
      rank: Placement.atTheBack(await this.tasks.placementsAt(station.id)),
      raisedBy: event.acceptedBy,
      now: this.clock.now(),
      newId: () => this.ids.generate(),
    });

    const raised = await this.raise.raise({ task, line });

    await this.chats.save(
      chat.proposalBecame(event.position, raised.id, this.clock.now()),
    );
  }
}
