import type { HostOutagesPort } from '@runners/application/ports/host-outages.port';
import type { HostOutageBeganIntegrationEvent } from '@shared-kernel/application/integration-events/host-outage-began.integration-event';
import type { HostOutageEndedIntegrationEvent } from '@shared-kernel/application/integration-events/host-outage-ended.integration-event';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { hostOutageWords } from '@work/application/rendering/host-outage-notice';
import type { Notices } from '@work/application/services/notices.service';

const RUNNERS_SETTINGS = 'settings/runners';

const OPENS_RUNNERS = 'Open runners';

// One notice for each outage, so that a later outage of the same hosts arrives as new.
const subjectOf = (outageId: string): string => `host-outage ${outageId}`;

// The admins of the workspace get one notice when the hosts of a pool or a trust all go offline, and it resolves itself once the outage ends. Runners is asked whether the outage still holds, so that a beginning that arrives after its end leaves no notice open.
export class TellAdminsOfHostOutages {
  constructor(
    private readonly outages: HostOutagesPort,
    private readonly notices: Notices,
  ) {}

  async began(event: HostOutageBeganIntegrationEvent): Promise<void> {
    if (!(await this.holds(event))) {
      return;
    }

    const words = hostOutageWords(event);

    await this.notices.createAboutWorkspace({
      workspaceId: WorkspaceId.of(event.workspaceId),
      form: 'advice',
      subject: subjectOf(event.outageId),
      link: RUNNERS_SETTINGS,
      linkLabel: OPENS_RUNNERS,
      externalLink: null,
      headline: words.headline,
      points: words.points,
      // The notice is one for every admin, so no admin resolves it while the hosts are still offline.
      autoResolve: true,
    });

    // The outage may have ended while the notice was raised, its end finding no notice yet.
    if (!(await this.holds(event))) {
      await this.resolved(event);
    }
  }

  ended(event: HostOutageEndedIntegrationEvent): Promise<void> {
    return this.resolved(event);
  }

  private async holds(
    event: HostOutageBeganIntegrationEvent,
  ): Promise<boolean> {
    return (
      (await this.outages.openOutageOf({
        kind: event.source,
        id: event.sourceId,
      })) === event.outageId
    );
  }

  private resolved(event: {
    readonly workspaceId: string;
    readonly outageId: string;
  }): Promise<void> {
    return this.notices.resolveInWorkspace({
      workspaceId: WorkspaceId.of(event.workspaceId),
      form: 'advice',
      subject: subjectOf(event.outageId),
    });
  }
}
