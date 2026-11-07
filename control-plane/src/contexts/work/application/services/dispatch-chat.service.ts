import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import {
  RunSpecContract,
  TRACE_PARENT_VAR,
} from '@runs/application/contracts/run-spec.contract';
import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { SavepointPort } from '@shared-kernel/application/ports/savepoint.port';
import { Release } from '@shared-kernel/domain/value-objects/release.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { toolManifestOf } from '@work/application/mappers/tool-manifest.mapper';
import type { ChatDispatching } from '@work/application/ports/chat-dispatch.port';
import type { ControlPlaneReleasePort } from '@work/application/ports/control-plane-release.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import {
  type BriefedMemory,
  type MemoryFolder,
  NOTHING_REMEMBERED,
  type TeamMemoriesPort,
} from '@work/application/ports/team-memories.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { Attached } from '@work/application/rendering/attached';
import { ChatBriefing } from '@work/application/rendering/chat-briefing';
import type {
  ChatToolExtensions,
  OfferedChatTool,
} from '@work/application/services/chat-tool-extensions.service';
import {
  type OrderedRun,
  runOrderOf,
} from '@work/application/services/ordered-run';
import { chatWords } from '@work/application/services/remembering-words';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import { builtInToolsForChat } from '@work/domain/services/built-in-tools';
import {
  chatPlacement,
  chatSetupOf,
} from '@work/domain/services/chat-placement';
import { CHAT_PRIORITY } from '@work/domain/services/chat-priority';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import {
  CHAT_RUN_API_LIFETIME_MS,
  CHAT_RUN_API_SCOPES,
} from '@work/domain/value-objects/chat-run-api-grant';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { REMOTE_VIA_GIT_PROXY } from '@work/domain/value-objects/run-checkout';

export class DispatchChat implements ChatDispatching {
  constructor(
    private readonly ids: IdGeneratorPort,
    private readonly launch: HarnessLaunchPort,
    private readonly tracing: TraceParentPort,
    private readonly teams: TeamDirectoryPort,
    private readonly lines: LineMapsPort,
    private readonly clock: ClockPort,
    private readonly memories: TeamMemoriesPort,
    private readonly logger: LoggerPort,
    private readonly savepoint: SavepointPort,
    private readonly spotlightUrl: string,
    private readonly controlPlane: ControlPlaneReleasePort,
    private readonly extensions: ChatToolExtensions,
  ) {}

  async takenUp(chat: Chat): Promise<Chat> {
    const command = this.launch.commandFor(chat.harness, {
      model: chat.model,
      effort: chat.effort,
    });

    return command
      ? chat.assignRun(RunId.of(this.ids.generate()), this.clock.now())
      : chat;
  }

  async ordered(
    chat: Chat,
    runId: RunId,
    handed: readonly MessagePosition[],
  ): Promise<OrderedRun | null> {
    const command = this.launch.commandFor(chat.harness, {
      model: chat.model,
      effort: chat.effort,
    });

    if (!command) {
      this.notDispatched(chat, runId, 'harness-has-no-command');
      return null;
    }

    const resume = chat.resume();
    const id = runId;
    const lines =
      chat.repositories.length > 0 ? await this.lines.ofTeam(chat.teamId) : [];
    const placement = chatPlacement(chat.repositories, lines);

    if (!placement) {
      this.notDispatched(chat, runId, 'no-placement');
      return null;
    }

    const memories = resume.sessionId
      ? NOTHING_REMEMBERED
      : await this.savepoint
          .inSavepoint(() =>
            this.memories.forBriefing({
              teamId: chat.teamId,
              lineId: null,
              stationId: null,
              repositories: chat.repositories,
              about: chatWords(chat),
              touched: async () => [],
            }),
          )
          .catch((error: unknown) => {
            this.logger.warn(
              { err: error, chatId: chat.id.value },
              'Briefing the chat without what the team remembers, which could not be read',
            );
            return NOTHING_REMEMBERED;
          });
    const offered = await this.extensions.offeredTo(chat);
    const briefing = resume.sessionId
      ? ChatBriefing.followUp(chat, handed)
      : await this.briefed(chat, memories.briefed, memories.folder, offered);

    const order = runOrderOf({
      id,
      workspaceId: chat.workspaceId,
      harness: chat.harness,
      priority: CHAT_PRIORITY,
      requester: WorkRequesters.chat(chat.id, chat.teamId),
      policy: WorkRequesters.chatPolicy,
      workspace: WorkRequesters.chatWorkspace(chat.id),
      apiGrant: chat.setup
        ? {
            actingFor: chat.startedBy.value,
            scopes: [...CHAT_RUN_API_SCOPES],
            lifetimeMs: CHAT_RUN_API_LIFETIME_MS,
          }
        : null,
      tags: {},
      placement,
      refusals: [],
      spec: {
        checkouts: chat.repositories.map((repository) => {
          const setup = chatSetupOf(repository, lines);

          return {
            remote: REMOTE_VIA_GIT_PROXY,
            path: repository.name,
            ...(setup ? { setup } : {}),
          };
        }),
        command: command.started({
          [TRACE_PARENT_VAR]: this.tracing.forChat(chat.id, id),
        }),
        briefing,
        handover: { options: [], noteLimit: 0 },
        resume: RunSpecContract.resumeOf(resume),
        manifest: [
          ...builtInToolsForChat({ settingUp: chat.setup !== null }).map(
            (each) => each.declared,
          ),
          ...offered.map((each) => each.declared),
        ].map(toolManifestOf),
        attachments: Attached.shapes(chat.sharedAttachments),
        ...(chat.setup ? { spotlightApi: true } : {}),
      },
    });

    return {
      order,
      briefedTask: null,
      briefedMemories: BriefedMemories.of({
        briefed: memories.briefed,
        omitted: memories.omitted,
      }),
      configuredAs: null,
    };
  }

  private async briefed(
    chat: Chat,
    memories: readonly BriefedMemory[],
    memoryFolder: MemoryFolder | null,
    offered: readonly OfferedChatTool[],
  ): Promise<string> {
    const team = await this.teams.find(chat.teamId);
    const lines = await this.lines.ofTeam(chat.teamId);

    return ChatBriefing.brief({
      chat,
      team: team?.name ?? null,
      lines,
      memories,
      memoryFolder,
      spotlightUrl: this.spotlightUrl,
      release: Release.published(this.controlPlane.release),
      extensions: offered.flatMap((each) => each.briefing ?? []),
    });
  }

  private notDispatched(chat: Chat, runId: RunId, reason: string): void {
    this.logger.info(
      {
        teamId: chat.teamId.value,
        chatId: chat.id.value,
        runId: runId.value,
        reason,
      },
      'Did not dispatch a chat run',
    );
  }
}
