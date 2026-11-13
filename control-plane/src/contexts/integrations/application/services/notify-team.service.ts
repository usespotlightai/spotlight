import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { InboxLinksPort } from '@integrations/application/ports/inbox-links.port';
import type {
  IntegrationRuntimePort,
  TeamNoticePayload,
} from '@integrations/application/ports/integration-runtime.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BindableNoticeEvent } from '@work/application/contracts/bindable-notice-events.contract';

export interface TeamNotice {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly form: string;
  readonly headline: string;
  readonly points: readonly string[];
  readonly externalLink: {
    readonly url: string;
    readonly label: string;
  } | null;
}

const NOTICE_RAISED: BindableNoticeEvent = 'notice.raised';

export class NotifyTeam {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly callAuthResolver: CallAuthResolver,
    private readonly links: InboxLinksPort,
    private readonly log: LoggerPort,
  ) {}

  async notify(notice: TeamNotice): Promise<void> {
    const { teamId } = notice;
    const definitions = await this.defined.ofTeam(teamId);
    const posting = this.runtime
      .integrations(definitions)
      .filter((each) => each.postsOn(NOTICE_RAISED));

    if (posting.length === 0) {
      return;
    }

    const payload: TeamNoticePayload = {
      kind: 'notice',
      notice: {
        form: notice.form,
        headline: notice.headline,
        points: notice.points,
        link: await this.links
          .notice(notice.workspaceId, notice.id)
          .catch((error: unknown) => {
            this.log.warn(
              { notice: notice.id, error },
              'Spotlight could not link to a notice',
            );

            return null;
          }),
        externalLink: notice.externalLink,
      },
    };

    for (const integration of posting) {
      try {
        const results = await this.runtime.post(
          definitions,
          integration,
          NOTICE_RAISED,
          payload,
          await this.callAuthResolver.of(teamId, integration),
        );

        for (const posted of results) {
          if (posted.kind === 'failed') {
            this.log.warn(
              {
                notice: notice.id,
                error: posted.error,
                target: posted.target,
              },
              'A service answered a notice with an error',
            );
          }
        }
      } catch (error) {
        this.log.warn(
          { err: error, notice: notice.id },
          'Posting a notice to a service',
        );
      }
    }
  }
}
