import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { InboxRequest } from '@work/domain/aggregates/inbox-request.aggregate';
import { UnknownInboxRequestError } from '@work/domain/exceptions/unknown-inbox-request.error';
import type { InboxRequestRepository } from '@work/domain/repositories/inbox-request.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import type { TeamStanding } from '@work/domain/value-objects/team-standing.vo';

interface SeenInboxRequest {
  readonly inboxRequest: InboxRequest;
  readonly standing: TeamStanding;
}

export class InboxRequestLoader {
  constructor(
    private readonly inboxRequests: InboxRequestRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly access: WorkAccess,
  ) {}

  async putTo(inboxRequestId: string, them: string): Promise<InboxRequest> {
    const { inboxRequest, standing } = await this.seen(inboxRequestId, them);

    standing.assertActsOnTasks(
      () => new UnknownInboxRequestError(inboxRequestId),
    );

    return inboxRequest;
  }

  async seenBy(inboxRequestId: string, them: string): Promise<InboxRequest> {
    return (await this.seen(inboxRequestId, them)).inboxRequest;
  }

  private async seen(
    inboxRequestId: string,
    them: string,
  ): Promise<SeenInboxRequest> {
    const viewer = UserId.of(them);
    const inboxRequest = await this.inboxRequests.find(
      InboxRequestId.of(inboxRequestId),
    );
    const task = inboxRequest
      ? await this.tasks.find(inboxRequest.taskId)
      : null;
    const line = task ? await this.lines.findByStation(task.stationId) : null;
    const standing = line
      ? await this.access.standingOn(line.teamId, viewer)
      : null;

    if (
      !inboxRequest ||
      !task ||
      !standing ||
      !InboxRequest.visibleTo({
        form: inboxRequest.form,
        viewer,
        assignee: task.assignee,
        seesTeam: standing.seesTasks,
        actsOnTeam: standing.actsOnTasks,
      })
    ) {
      throw new UnknownInboxRequestError(inboxRequestId);
    }

    return { inboxRequest, standing };
  }
}
