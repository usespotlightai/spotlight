import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { ProposalAcceptances } from '@work/application/services/proposal-acceptances';
import type { RaiseTask } from '@work/application/services/raise-task';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { Placement } from '@work/domain/services/placement';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';

export class CreateTaskFromProposal implements ProposalAcceptances {
  constructor(
    private readonly chats: ChatRepository,
    private readonly lines: LineRepository,
    private readonly placements: TaskPlacementsPort,
    private readonly raise: RaiseTask,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async onProposalAccepted(event: ProposalAccepted): Promise<void> {
    const line = await this.lines.find(event.placement.lineId);
    const station = line?.stationAt(event.placement.stationId);

    if (!line || !station || !line.workspaceId.equals(event.workspaceId)) {
      const chat = await this.chats.find(event.chatId);

      if (chat) {
        await this.chats.save(chat.recordAcceptanceFailure(event.position));
      }

      return;
    }

    await this.raise.raise({
      task: Task.add({
        line,
        at: station.id,
        title: event.title,
        description: event.description,
        rank: Placement.atTheBack(
          (await this.placements.placementsAt(station.id)).map(
            (each) => each.rank,
          ),
        ),
        raisedBy: event.acceptedBy,
        proposedIn: ProposalOrigin.of({
          chatId: event.chatId,
          position: event.position,
        }),
        now: this.clock.now(),
        newId: () => this.ids.generate(),
      }),
      line,
    });
  }

  async onTaskOpened(event: TaskOpened): Promise<void> {
    if (!event.proposedIn) {
      return;
    }

    const chat = await this.chats.find(event.proposedIn.chatId);

    if (!chat) {
      return;
    }

    await this.chats.save(
      chat.proposalBecame(
        event.proposedIn.position,
        event.taskId,
        this.clock.now(),
      ),
    );
  }
}
