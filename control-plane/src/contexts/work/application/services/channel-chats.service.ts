import type { MemberDirectoryPort } from '@identity/application/ports/member-directory.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BindableChatEvent } from '@work/application/contracts/bindable-chat-events.contract';
import type {
  ReceivedHappening,
  StartsChat,
} from '@work/application/mappers/happened.mapper';
import type {
  ChannelNoticeDto,
  ChannelNoticesPort,
} from '@work/application/ports/channel-notices.port';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import { ChannelReplies } from '@work/application/rendering/channel-replies';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { chatPlacement } from '@work/domain/services/chat-placement';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ChatReply } from '@work/domain/value-objects/chat-reply.vo';

export interface ChannelAnswer {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly happened: ReceivedHappening;
  readonly event: Extract<
    BindableChatEvent,
    'chat.refused' | 'chat.acknowledged'
  >;
  readonly body: string;
}

type Reached = ReceivedHappening & { readonly chat: StartsChat };

export class ChannelChats {
  constructor(
    private readonly chats: ChatRepository,
    private readonly lines: LineRepository,
    private readonly members: MemberDirectoryPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly launch: HarnessLaunchPort,
    private readonly defaultHarness: HarnessId,
    private readonly dispatch: ChatDispatching,
    private readonly notices: ChannelNoticesPort,
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly logger: LoggerPort,
  ) {}

  static reaches(happened: ReceivedHappening): happened is Reached {
    return happened.chat !== null;
  }

  async reached(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happened: Reached,
    attachments: readonly Attachment[],
  ): Promise<ChannelAnswer | null> {
    const speaker = happened.chat.email
      ? await this.members.byEmail(workspaceId, happened.chat.email)
      : null;
    const said = happened.anchor?.body.trim() ?? '';
    const chat = await this.chats.findByMarks(
      workspaceId,
      happened.correlationKeys,
    );

    if (chat) {
      return this.continued(chat, speaker, said, happened, attachments);
    }

    if (!teamId) {
      this.logger.info(
        {
          workspaceId: workspaceId.value,
          happening: happened.payload.happening.value,
        },
        'Did not start a chat for a word that no team reads',
      );

      return null;
    }

    return this.started(
      workspaceId,
      teamId,
      speaker,
      said,
      happened,
      attachments,
    );
  }

  async answer(answer: ChannelAnswer): Promise<void> {
    try {
      await this.notices.notify(
        {
          workspaceId: answer.workspaceId.value,
          teamId: answer.teamId.value,
          marks:
            answer.happened.chat?.marks.map((each) => ({
              kind: each.mark.kind,
              value: each.mark.value,
            })) ?? [],
          body: answer.body,
          proposals: [],
          chatId: null,
          taskId: null,
        } satisfies ChannelNoticeDto,
        answer.event,
      );
    } catch (error) {
      this.logger.warn(
        {
          err: error,
          workspaceId: answer.workspaceId.value,
          happening: answer.happened.payload.happening.value,
          event: answer.event,
        },
        'Could not answer a word in its channel',
      );
    }
  }

  private async continued(
    chat: Chat,
    speaker: UserId | null,
    said: string,
    happened: Reached,
    attachments: readonly Attachment[],
  ): Promise<ChannelAnswer | null> {
    const refused = (body: string): ChannelAnswer => ({
      workspaceId: chat.workspaceId,
      teamId: chat.teamId,
      happened,
      event: 'chat.refused',
      body,
    });

    if (!speaker) {
      return refused(ChannelReplies.unknownPerson);
    }

    if (!chat.isStartedBy(speaker)) {
      return refused(ChannelReplies.notTheStarter);
    }

    const reply = ChatReply.read(said);

    if (reply.decision) {
      const pick = reply.pick(chat.proposals);

      if (pick.kind === 'none-open') {
        return refused(ChannelReplies.noneOpen);
      }

      if (pick.kind === 'unnamed') {
        return refused(ChannelReplies.unnamed(pick.open));
      }

      if (pick.kind === 'no-such') {
        return refused(ChannelReplies.noSuch(pick.number));
      }

      const now = this.clock.now();

      await this.chats.save(
        reply.decision === 'accept'
          ? chat.accept(pick.proposal.position, speaker, now)
          : chat.dismiss(pick.proposal.position, speaker, now),
      );

      return null;
    }

    if (!said && attachments.length === 0) {
      return refused(ChannelReplies.nothingSaid);
    }

    const withMessage = chat.addMessage({
      by: speaker,
      body: ChatMessageBody.fromInput(said, attachments),
      attachments,
      at: this.clock.now(),
    });

    await this.chats.save(
      withMessage.wantsFollowUp
        ? await this.dispatch.takenUp(withMessage)
        : withMessage,
    );

    return null;
  }

  private async started(
    workspaceId: WorkspaceId,
    teamId: TeamId,
    speaker: UserId | null,
    said: string,
    happened: Reached,
    attachments: readonly Attachment[],
  ): Promise<ChannelAnswer | null> {
    const refused = (body: string): ChannelAnswer => ({
      workspaceId,
      teamId,
      happened,
      event: 'chat.refused',
      body,
    });

    if (!speaker) {
      return refused(ChannelReplies.unknownPerson);
    }

    if (!(await this.workspaces.findTeamForMember(teamId.value, speaker))) {
      return refused(ChannelReplies.notInTeam);
    }

    if (!said && attachments.length === 0) {
      return refused(ChannelReplies.nothingSaid);
    }

    const harness = happened.chat.harness ?? this.defaultHarness.value;

    if (!this.launch.catalogue().some((each) => each.id === harness)) {
      return refused(ChannelReplies.unknownHarness(harness));
    }

    const lines = await this.lines.ofTeam(teamId);
    const repositories = lines.flatMap((line) => line.repositories.all);

    if (!chatPlacement(repositories, lines)) {
      return refused(ChannelReplies.mixedImages);
    }

    const chat = Chat.start({
      workspaceId,
      teamId,
      startedBy: speaker,
      harness: HarnessId.of(harness),
      repositories,
      body: ChatMessageBody.fromInput(said, attachments),
      attachments,
      marks: happened.chat.marks,
      now: this.clock.now(),
      newId: () => this.ids.generate(),
    });

    await this.chats.add(await this.dispatch.takenUp(chat));

    return null;
  }
}
