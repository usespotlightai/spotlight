import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { SavepointPort } from '@shared-kernel/application/ports/savepoint.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import {
  REMOTE_VIA_GIT_PROXY,
  RunSpecContract,
  TRACE_PARENT_VAR,
} from '@work/application/contracts/run-spec.contract';
import { toolManifestOf } from '@work/application/mappers/tool-manifest.mapper';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import {
  type BriefedMemory,
  type MemoryFolder,
  NOTHING_REMEMBERED,
  type TeamMemoriesPort,
} from '@work/application/ports/team-memories.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { Attached } from '@work/application/rendering/attached';
import { ChatBriefing } from '@work/application/rendering/chat-briefing';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import { chatWords } from '@work/application/services/remembering-words';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { builtInToolsForChat } from '@work/domain/services/built-in-tools';
import {
  chatPlacement,
  chatSetupOf,
} from '@work/domain/services/chat-placement';
import { CHAT_PRIORITY } from '@work/domain/services/chat-priority';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';

export class DispatchChat implements ChatDispatching {
  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
    private readonly launch: HarnessLaunchPort,
    private readonly tracing: TraceParentPort,
    private readonly teams: TeamDirectoryPort,
    private readonly lines: LineRepository,
    private readonly clock: ClockPort,
    private readonly memories: TeamMemoriesPort,
    private readonly logger: LoggerPort,
    private readonly savepoint: SavepointPort,
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

  async enqueue(
    chat: Chat,
    runId: RunId,
    handed: readonly MessagePosition[],
  ): Promise<boolean> {
    const command = this.launch.commandFor(chat.harness, {
      model: chat.model,
      effort: chat.effort,
    });

    if (!command) {
      this.notDispatched(chat, runId, 'harness-has-no-command');
      return false;
    }

    const resume = chat.resume();
    const id = runId;
    const lines =
      chat.repositories.length > 0 ? await this.lines.ofTeam(chat.teamId) : [];
    const placement = chatPlacement(chat.repositories, lines);

    if (!placement) {
      this.notDispatched(chat, runId, 'no-placement');
      return false;
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
    const briefing = resume.sessionId
      ? ChatBriefing.followUp(chat, handed)
      : await this.briefed(chat, memories.briefed, memories.folder);

    const queued = Run.enqueue({
      id,
      workspaceId: chat.workspaceId,
      harness: chat.harness,
      priority: CHAT_PRIORITY,
      subject: RunSubject.chat(chat.id),
      placement,
      briefedWith: BriefedMemories.of({
        briefed: memories.briefed,
        omitted: memories.omitted,
      }),
      spec: RunSpec.of({
        checkouts: chat.repositories.map((repository) => {
          const setup = chatSetupOf(repository, lines);

          return {
            remote: REMOTE_VIA_GIT_PROXY,
            path: repository.name,
            ...(setup ? { setup: setup.value } : {}),
          };
        }),
        command: command.started({
          [TRACE_PARENT_VAR]: this.tracing.forChat(chat.id, id),
        }),
        briefing,
        handover: { options: [], noteLimit: 0 },
        resume: RunSpecContract.resumeOf(resume),
        manifest: builtInToolsForChat(chat.setup !== null).map((each) =>
          toolManifestOf(each.declared),
        ),
        attachments: Attached.shapes(chat.allAttachments),
        ...(chat.setup ? { spotlightApi: true } : {}),
      }),
    });

    await this.runs.add(queued);

    return true;
  }

  private async briefed(
    chat: Chat,
    memories: readonly BriefedMemory[],
    memoryFolder: MemoryFolder | null,
  ): Promise<string> {
    const team = await this.teams.find(chat.teamId);
    const lines = await this.lines.ofTeam(chat.teamId);

    return ChatBriefing.brief({
      chat,
      team: team?.name ?? null,
      lines,
      memories,
      memoryFolder,
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
