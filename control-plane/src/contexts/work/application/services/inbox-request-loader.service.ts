import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { InboxRequest } from '@work/domain/aggregates/inbox-request.aggregate';
import { UnknownInboxRequestError } from '@work/domain/exceptions/unknown-inbox-request.error';
import type { InboxRequestRepository } from '@work/domain/repositories/inbox-request.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';

export class InboxRequestLoader {
  constructor(
    private readonly inboxRequests: InboxRequestRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly access: WorkspaceAccessPort,
  ) {}

  async putTo(inboxRequestId: string, them: string): Promise<InboxRequest> {
    const viewer = UserId.of(them);
    const inboxRequest = await this.inboxRequests.find(
      InboxRequestId.of(inboxRequestId),
    );
    const task = inboxRequest
      ? await this.tasks.find(inboxRequest.taskId)
      : null;
    const line = task ? await this.lines.findByStation(task.stationId) : null;

    if (
      !inboxRequest ||
      !task ||
      !line ||
      !InboxRequest.visibleTo({
        form: inboxRequest.form,
        viewer,
        assignee: task.assignee,
        seesTeam:
          InboxRequest.requiredAccess(inboxRequest.form) === 'seesTeam' &&
          (await this.access.onTeam(line.teamId.value, viewer)) !== null,
        readsTeamInsights:
          InboxRequest.requiredAccess(inboxRequest.form) ===
            'readsTeamInsights' &&
          (await this.access.permissionsAsTeamReader(
            line.teamId.value,
            PersonPrincipal.of(viewer),
          )) !== null,
      })
    ) {
      throw new UnknownInboxRequestError(inboxRequestId);
    }

    return inboxRequest;
  }
}
