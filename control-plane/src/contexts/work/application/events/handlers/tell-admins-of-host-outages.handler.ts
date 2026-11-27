import type { HostOutagesPort } from '@runners/application/ports/host-outages.port';
import type { HostOutageBeganIntegrationEvent } from '@shared-kernel/application/integration-events/host-outage-began.integration-event';
import type { HostOutageEndedIntegrationEvent } from '@shared-kernel/application/integration-events/host-outage-ended.integration-event';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { NoticesPort } from '@work/application/ports/notices.port';
import { hostOutageWords } from '@work/application/rendering/host-outage-notice';

const RUNNERS_SETTINGS = 'settings/runners';

const OPENS_RUNNERS = 'Open runners';

// One notice for each pool or trust: a later outage of the same hosts opens it again, rather than adding another.
const subjectOf = (event: {
  readonly source: 'pool' | 'trust';
  readonly sourceId: string;
}): string => `host-outage ${event.source}:${event.sourceId}`;

// The admins of the workspace get one notice when the hosts of a pool or a trust all go offline, and it resolves itself once the outage ends. Runners is asked whether the outage still holds, so that an event that arrives late changes nothing.
export class TellAdminsOfHostOutages {
  constructor(
    private readonly outages: HostOutagesPort,
    private readonly notices: NoticesPort,
  ) {}

  async began(event: HostOutageBeganIntegrationEvent): Promise<void> {
    if (
      (await this.outages.openOutageOf({
        kind: event.source,
        id: event.sourceId,
      })) !== event.outageId
    ) {
      return;
    }

    const words = hostOutageWords(event);

    await this.notices.raise({
      workspaceId: WorkspaceId.of(event.workspaceId),
      teamId: null,
      addressee: null,
      form: 'advice',
      subject: subjectOf(event),
      link: RUNNERS_SETTINGS,
      linkLabel: OPENS_RUNNERS,
      externalLink: null,
      headline: words.headline,
      points: words.points,
    });
  }

  async ended(event: HostOutageEndedIntegrationEvent): Promise<void> {
    if (
      (await this.outages.openOutageOf({
        kind: event.source,
        id: event.sourceId,
      })) !== null
    ) {
      return;
    }

    await this.notices.resolveInWorkspace({
      workspaceId: WorkspaceId.of(event.workspaceId),
      form: 'advice',
      subject: subjectOf(event),
    });
  }
}
