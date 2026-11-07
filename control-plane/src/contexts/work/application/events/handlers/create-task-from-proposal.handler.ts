import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { ProposalAcceptances } from '@work/application/ports/proposal-acceptances.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { AttachmentCopies } from '@work/application/services/attachment-copies';
import type { CreateTask } from '@work/application/services/create-task';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';
import { ProposalAlreadyOpenedError } from '@work/domain/exceptions/proposal-already-opened.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { Placement } from '@work/domain/services/placement';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';

export class CreateTaskFromProposal implements ProposalAcceptances {
  constructor(
    private readonly chats: ChatRepository,
    private readonly lines: LineMapsPort,
    private readonly placements: TaskPlacementsPort,
    private readonly createTask: CreateTask,
    private readonly copies: AttachmentCopies,
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

    const attachments = await this.copies.copy(
      event.workspaceId,
      event.attachments,
      (place) => `${event.chatId.value}-${event.position.value}-task-${place}`,
    );

    try {
      await this.createTask.create({
        task: Task.add({
          line,
          at: station.id,
          title: event.title,
          description: event.description,
          attachments,
          rank: Placement.entering(
            'opened',
            (await this.placements.placementsAt(station.id)).map(
              (each) => each.rank,
            ),
          ),
          createdBy: event.acceptedBy,
          proposedIn: ProposalOrigin.of({
            chatId: event.chatId,
            position: event.position,
          }),
          now: this.clock.now(),
          newId: () => this.ids.generate(),
        }),
        line,
      });
    } catch (error) {
      if (!(error instanceof ProposalAlreadyOpenedError)) {
        throw error;
      }
    }
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
