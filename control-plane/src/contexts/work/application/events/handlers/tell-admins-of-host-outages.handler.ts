import type { HostOutageBeganIntegrationEvent } from '@shared-kernel/application/integration-events/host-outage-began.integration-event';
import type { HostOutageEndedIntegrationEvent } from '@shared-kernel/application/integration-events/host-outage-ended.integration-event';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { NoticesPort } from '@work/application/ports/notices.port';
import { hostOutageWords } from '@work/application/rendering/host-outage-notice';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { Notice } from '@work/domain/aggregates/notice.aggregate';

const RUNNERS_SETTINGS = 'settings/runners';

const OPENS_RUNNERS = 'Open runners';

const subjectOf = (outageId: string): string => `host-outage ${outageId}`;

// Each owner and admin of the workspace gets one notice when the hosts of a pool or a trust all go offline. The notices resolve themselves when the outage ends.
export class TellAdminsOfHostOutages {
  constructor(
    private readonly access: WorkAccess,
    private readonly notices: NoticesPort,
  ) {}

  async began(event: HostOutageBeganIntegrationEvent): Promise<void> {
    const workspaceId = WorkspaceId.of(event.workspaceId);
    const words = hostOutageWords(event);

    for (const { admin, teamsSeen } of await this.access.adminsIn(
      workspaceId,
    )) {
      const teamId = Notice.homeTeamOf(teamsSeen);

      if (teamId) {
        await this.notices.create({
          workspaceId,
          teamId,
          addressee: admin,
          form: 'advice',
          subject: subjectOf(event.outageId),
          link: RUNNERS_SETTINGS,
          linkLabel: OPENS_RUNNERS,
          linkScope: 'workspace',
          externalLink: null,
          headline: words.headline,
          points: words.points,
        });
      }
    }
  }

  ended(event: HostOutageEndedIntegrationEvent): Promise<void> {
    return this.notices.resolveEverywhere({
      workspaceId: WorkspaceId.of(event.workspaceId),
      form: 'advice',
      subject: subjectOf(event.outageId),
    });
  }
}
