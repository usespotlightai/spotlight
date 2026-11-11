import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatMessage } from '@work/domain/entities/chat-message.entity';
import { TaskProposal } from '@work/domain/entities/task-proposal.entity';
import { ChatMarkTakenError } from '@work/domain/exceptions/chat-mark-taken.error';
import { ChatVersionConflictError } from '@work/domain/exceptions/chat-version-conflict.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMark } from '@work/domain/value-objects/chat-mark.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ChatTitle } from '@work/domain/value-objects/chat-title.vo';
import { CiSetup } from '@work/domain/value-objects/ci-setup.vo';
import { ConfigFolder } from '@work/domain/value-objects/config-folder.vo';
import type { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { TargetStation } from '@work/domain/value-objects/target-station.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { claimAttachments } from '@work/infrastructure/persistence/drizzle/attachment-claims';
import {
  type ChatSetupRow,
  chat,
  chatAttachment,
  chatMark,
  chatMessage,
  type ProposalRow,
} from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { and, asc, eq, or } from 'drizzle-orm';

type Row = typeof chat.$inferSelect;
type MessageRow = typeof chatMessage.$inferSelect;
type AttachmentRow = typeof chatAttachment.$inferSelect;
type MarkRow = typeof chatMark.$inferSelect;

const toProposal = (
  row: ProposalRow | null,
  position: MessagePosition,
): TaskProposal | null =>
  row
    ? TaskProposal.rehydrate({
        position,
        placement: ProposalPlacement.of({
          lineId: LineId.of(row.lineId),
          stationId: StationId.of(row.stationId),
        }),
        title: TaskTitle.of(row.title),
        description: row.description
          ? TaskDescription.of(row.description)
          : null,
        state: row.state,
        taskId: row.taskId ? TaskId.of(row.taskId) : null,
        decidedAt: row.decidedAt ? new Date(row.decidedAt) : null,
      })
    : null;

const fromProposal = (proposal: TaskProposal | null): ProposalRow | null =>
  proposal
    ? {
        lineId: proposal.placement.lineId.value,
        stationId: proposal.placement.stationId.value,
        title: proposal.title.value,
        description: proposal.description?.value ?? null,
        state: proposal.state,
        taskId: proposal.taskId?.value ?? null,
        decidedAt: proposal.decidedAt?.toISOString() ?? null,
      }
    : null;

const toMessage = (
  row: MessageRow,
  attachments: readonly AttachmentRow[],
): ChatMessage => {
  const position = MessagePosition.of(row.position);

  return ChatMessage.rehydrate({
    position,
    kind: row.kind,
    body: ChatMessageBody.of(row.body),
    at: row.at,
    author: row.authorId ? UserId.of(row.authorId) : null,
    runId: row.runId ? RunId.of(row.runId) : null,
    attachments: attachments
      .filter((each) => each.messagePosition === row.position)
      .sort((a, b) => a.place - b.place)
      .map((each) => Attachment.rehydrate(each)),
    traces: row.traces.map((each) =>
      TraceReference.of({
        taskId: TaskId.of(each.taskId),
        title: TaskTitle.of(each.title),
        teamId: TeamId.of(each.teamId),
      }),
    ),
    proposal: toProposal(row.proposal ?? null, position),
    acknowledgedAt: row.acknowledgedAt,
    acknowledgedBy: row.acknowledgedByRunId
      ? RunId.of(row.acknowledgedByRunId)
      : null,
  });
};

const setupRow = (setup: ConfigFolder | null): ChatSetupRow | null =>
  setup
    ? {
        repository: setup.repository.value,
        folder: setup.folder,
        pullRequest: setup.pullRequest?.value ?? null,
        ci: setup.ci
          ? {
              defaultBranch: setup.ci.defaultBranch,
              defaultBranchProtected: setup.ci.defaultBranchProtected,
              pullRequestsTrustId: setup.ci.pullRequestsTrustId,
              defaultBranchTrustId: setup.ci.defaultBranchTrustId,
              variables: setup.ci.variables,
            }
          : null,
      }
    : null;

const toChat = (
  row: Row,
  messages: readonly MessageRow[],
  attachments: readonly AttachmentRow[],
  marks: readonly MarkRow[],
): Chat =>
  Chat.rehydrate({
    id: ChatId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    startedBy: UserId.of(row.startedById),
    title: ChatTitle.of(row.title),
    harness: HarnessId.of(row.harness),
    model: row.model ? HarnessModel.of(row.model) : null,
    effort: row.effort ? Effort.of(row.effort) : null,
    repositories: row.repositories.map((each) => Repository.of(each)),
    targetStation: row.targetStation
      ? TargetStation.rehydrate({
          teamId: TeamId.of(row.teamId),
          lineId: LineId.of(row.targetStation.lineId),
          lineKey: LineKey.of(row.targetStation.lineKey),
          lineName: LineName.of(row.targetStation.lineName),
          stationId: StationId.of(row.targetStation.stationId),
          stationKey: StationKey.of(row.targetStation.stationKey),
          stationName: StationName.of(row.targetStation.stationName),
        })
      : null,
    setup: row.setup
      ? ConfigFolder.rehydrate({
          repository: Repository.of(row.setup.repository),
          folder: row.setup.folder,
          pullRequest: row.setup.pullRequest
            ? PullRequestUrl.of(row.setup.pullRequest)
            : null,
          ci: row.setup.ci ? CiSetup.of(row.setup.ci) : null,
        })
      : null,
    messages: messages.map((each) => toMessage(each, attachments)),
    marks: marks.map((each) =>
      ChatMark.of(Mark.of(each.kind, each.value), each.finds),
    ),
    currentRunId: row.currentRunId ? RunId.of(row.currentRunId) : null,
    session: row.sessionId ? HarnessSession.of(row.sessionId) : null,
    claimedBy: row.runnerId ? RunnerId.of(row.runnerId) : null,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    readAt: row.readAt,
    version: row.version,
  });

@Injectable()
export class DrizzleChatRepository implements ChatRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Chat): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: Chat): Promise<void> {
    await this.context.db.insert(chat).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      teamId: added.teamId.value,
      startedById: added.startedBy.value,
      title: added.title.value,
      harness: added.harness.value,
      model: added.model?.value ?? null,
      effort: added.effort?.value ?? null,
      repositories: added.repositories.map((each) => each.value),
      targetStation: added.targetStation
        ? {
            lineId: added.targetStation.lineId.value,
            lineKey: added.targetStation.lineKey.value,
            lineName: added.targetStation.lineName.value,
            stationId: added.targetStation.stationId.value,
            stationKey: added.targetStation.stationKey.value,
            stationName: added.targetStation.stationName.value,
          }
        : null,
      setup: setupRow(added.setup),
      currentRunId: added.currentRunId?.value ?? null,
      sessionId: added.session?.value ?? null,
      workingCopyReleasedAt: added.workingCopyRelease.releasedAt,
      runnerId: added.claimedBy?.value ?? null,
      createdAt: added.createdAt,
      resolvedAt: added.resolvedAt,
      readAt: added.readAt,
    });

    if (added.marks.length > 0) {
      try {
        await this.context.db.insert(chatMark).values(
          added.marks.map((each) => ({
            workspaceId: added.workspaceId.value,
            chatId: added.id.value,
            kind: each.mark.kind,
            value: each.mark.value,
            finds: each.finds,
          })),
        );
      } catch (error) {
        if (violates(error, UNIQUE_VIOLATION, 'chat_mark_finding_uidx')) {
          throw new ChatMarkTakenError(
            added.marks
              .filter((each) => each.finds)
              .map((each) => `${each.mark.kind}:${each.mark.value}`)
              .join(', '),
          );
        }

        throw error;
      }
    }

    await this.writeMessages(added);
  }

  async save(saved: Chat): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async stored(saved: Chat): Promise<void> {
    const written = await this.context.db
      .update(chat)
      .set({
        version: saved.version + 1,
        setup: setupRow(saved.setup),
        model: saved.model?.value ?? null,
        effort: saved.effort?.value ?? null,
        currentRunId: saved.currentRunId?.value ?? null,
        sessionId: saved.session?.value ?? null,
        workingCopyReleasedAt: saved.workingCopyRelease.releasedAt,
        runnerId: saved.claimedBy?.value ?? null,
        resolvedAt: saved.resolvedAt,
        readAt: saved.readAt,
      })
      .where(and(eq(chat.id, saved.id.value), eq(chat.version, saved.version)))
      .returning({ id: chat.id });

    if (written.length === 0) {
      throw new ChatVersionConflictError(saved.id.value);
    }

    await this.writeMessages(saved);
  }

  async remove(removed: Chat): Promise<void> {
    await this.context.inTransaction(async () => {
      const gone = await this.context.db
        .delete(chat)
        .where(
          and(eq(chat.id, removed.id.value), eq(chat.version, removed.version)),
        )
        .returning({ id: chat.id });

      if (gone.length === 0) {
        throw new ChatVersionConflictError(removed.id.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }

  async ofTeam(teamId: TeamId): Promise<Chat[]> {
    const found = await this.context.db
      .select()
      .from(chat)
      .where(eq(chat.teamId, teamId.value));

    const chats: Chat[] = [];

    for (const each of found) {
      chats.push(await this.whole(each));
    }

    return chats;
  }

  async find(id: ChatId): Promise<Chat | null> {
    const [found] = await this.context.db
      .select()
      .from(chat)
      .where(eq(chat.id, id.value))
      .limit(1);

    return found ? this.whole(found) : null;
  }

  async findByCorrelation(
    workspaceId: WorkspaceId,
    correlationKeys: CorrelationKeys,
  ): Promise<Chat | null> {
    if (correlationKeys.marks.length === 0) {
      return null;
    }

    const [marked] = await this.context.db
      .select({ chatId: chatMark.chatId })
      .from(chatMark)
      .where(
        and(
          eq(chatMark.workspaceId, workspaceId.value),
          eq(chatMark.finds, true),
          or(
            ...correlationKeys.marks.map((mark) =>
              and(eq(chatMark.kind, mark.kind), eq(chatMark.value, mark.value)),
            ),
          ),
        ),
      )
      .limit(1);

    if (!marked) {
      return null;
    }

    const [found] = await this.context.db
      .select()
      .from(chat)
      .where(eq(chat.id, marked.chatId))
      .limit(1)
      .for('update');

    return found ? this.whole(found) : null;
  }

  private async whole(found: Row): Promise<Chat> {
    const messages = await this.context.db
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.chatId, found.id))
      .orderBy(asc(chatMessage.position));
    const attachments = await this.context.db
      .select()
      .from(chatAttachment)
      .where(eq(chatAttachment.chatId, found.id));

    const marks = await this.context.db
      .select()
      .from(chatMark)
      .where(eq(chatMark.chatId, found.id));

    return toChat(found, messages, attachments, marks);
  }

  private async writeMessages(written: Chat): Promise<void> {
    await claimAttachments(
      this.context.db,
      written.workspaceId,
      { chatId: written.id.value },
      written.allAttachments,
    );

    for (const message of written.messages) {
      const position = message.position.value;
      const proposal = fromProposal(message.proposal);

      await this.context.db
        .insert(chatMessage)
        .values({
          chatId: written.id.value,
          position,
          kind: message.kind,
          body: message.body.value,
          at: message.at,
          authorId: message.author?.value ?? null,
          runId: message.runId?.value ?? null,
          traces: message.traces.map((each) => ({
            taskId: each.taskId.value,
            title: each.title.value,
            teamId: each.teamId.value,
          })),
          proposal,
          acknowledgedAt: message.acknowledgedAt,
          acknowledgedByRunId: message.acknowledgedBy?.value ?? null,
        })
        .onConflictDoUpdate({
          target: [chatMessage.chatId, chatMessage.position],
          set: {
            proposal,
            acknowledgedAt: message.acknowledgedAt,
            acknowledgedByRunId: message.acknowledgedBy?.value ?? null,
          },
        });

      if (message.attachments.length === 0) {
        continue;
      }

      await this.context.db
        .insert(chatAttachment)
        .values(
          message.attachments.map((each, place) => ({
            id: each.id.value,
            chatId: written.id.value,
            messagePosition: position,
            place,
            name: each.name,
            contentType: each.contentType,
            size: each.size,
          })),
        )
        .onConflictDoNothing({ target: chatAttachment.id });
    }
  }
}
