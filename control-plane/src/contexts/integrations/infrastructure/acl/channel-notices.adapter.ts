import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { InboxLinksPort } from '@integrations/application/ports/inbox-links.port';
import type {
  ChatPayload,
  IntegrationRuntimePort,
} from '@integrations/application/ports/integration-runtime.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { BindableChatEvent } from '@work/application/contracts/bindable-chat-events.contract';
import type {
  ChannelNoticeDto,
  ChannelNoticesPort,
} from '@work/application/ports/channel-notices.port';

export class ChannelNotices implements ChannelNoticesPort {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly callAuthResolver: CallAuthResolver,
    private readonly links: InboxLinksPort,
    private readonly log: LoggerPort,
  ) {}

  async notify(
    notice: ChannelNoticeDto,
    event: BindableChatEvent,
  ): Promise<void> {
    const teamId = TeamId.of(notice.teamId);
    const definitions = await this.defined.ofTeam(teamId);
    const posting = this.runtime
      .integrations(definitions)
      .filter((each) => each.postsOn(event));

    if (posting.length === 0) {
      return;
    }

    const payload: ChatPayload = {
      chat: {
        marks: Object.fromEntries(
          notice.marks.map((each) => [each.kind, each.value]),
        ),
      },
      reply: { body: notice.body, link: await this.linkOf(notice) },
    };

    for (const integration of posting) {
      try {
        const posted = await this.runtime.post(
          definitions,
          integration,
          event,
          payload,
          await this.callAuthResolver.of(teamId, integration),
        );

        if (posted.kind === 'failed') {
          this.log.warn(
            {
              chat: notice.chatId,
              error: posted.error,
              target: posted.target,
              marks: payload.chat.marks,
            },
            'A service answered a chat’s word with an error',
          );
        }
      } catch (error) {
        this.log.warn(
          { err: error, chat: notice.chatId },
          'Posting a chat’s word to a service',
        );
      }
    }
  }

  private async linkOf(notice: ChannelNoticeDto): Promise<string | null> {
    if (notice.taskId) {
      return this.links.task(notice.workspaceId, notice.teamId, notice.taskId);
    }

    return notice.chatId
      ? this.links.chat(notice.workspaceId, notice.teamId, notice.chatId)
      : null;
  }
}
