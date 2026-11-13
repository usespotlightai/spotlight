import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { InboxLinksPort } from '@integrations/application/ports/inbox-links.port';
import type {
  ChatPayload,
  IntegrationRuntimePort,
} from '@integrations/application/ports/integration-runtime.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BindableChatEvent } from '@work/application/contracts/bindable-chat-events.contract';

export interface ChannelNotice {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly marks: Readonly<Record<string, string>>;
  readonly body: string;
  readonly proposals: ChatPayload['reply']['proposals'];
  readonly chatId: string | null;
  readonly taskId: TaskId | null;
}

export class NotifyChannel {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly callAuthResolver: CallAuthResolver,
    private readonly links: InboxLinksPort,
    private readonly log: LoggerPort,
  ) {}

  async notify(notice: ChannelNotice, event: BindableChatEvent): Promise<void> {
    const { teamId } = notice;
    const definitions = await this.defined.ofTeam(teamId);
    const posting = this.runtime
      .integrations(definitions)
      .filter((each) => each.postsOn(event));

    if (posting.length === 0) {
      return;
    }

    const payload: ChatPayload = {
      kind: 'chat',
      chat: { marks: notice.marks },
      reply: {
        body: notice.body,
        link: await this.linkOf(notice),
        proposals: notice.proposals,
      },
    };

    for (const integration of posting) {
      try {
        const results = await this.runtime.post(
          definitions,
          integration,
          event,
          payload,
          await this.callAuthResolver.of(teamId, integration),
        );

        for (const posted of results) {
          if (posted.kind === 'failed') {
            this.log.warn(
              {
                chat: notice.chatId,
                error: posted.error,
                target: posted.target,
                marks: payload.chat.marks,
              },
              'A service answered a chat notice with an error',
            );
          }
        }
      } catch (error) {
        this.log.warn(
          { err: error, chat: notice.chatId },
          'Posting a chat notice to a service',
        );
      }
    }
  }

  private async linkOf(notice: ChannelNotice): Promise<string | null> {
    if (notice.taskId) {
      return this.links.task(notice.workspaceId, notice.teamId, notice.taskId);
    }

    return notice.chatId
      ? this.links.chat(notice.workspaceId, notice.teamId, notice.chatId)
      : null;
  }
}
