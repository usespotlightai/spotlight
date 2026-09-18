import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import {
  RunSpecContract,
  THROUGH_SPOTLIGHT,
  TRACE_PARENT_VAR,
} from '@work/application/contracts/run-spec.contract';
import { toolManifestOf } from '@work/application/mappers/tool-manifest.mapper';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { Attached } from '@work/application/rendering/attached';
import { ChatBriefing } from '@work/application/rendering/chat-briefing';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { builtInToolsFor } from '@work/domain/services/built-in-tools';
import { CHAT_PRIORITY } from '@work/domain/services/chat-priority';
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
  ) {}

  async takenUp(chat: Chat): Promise<Chat> {
    const command = this.launch.commandFor(chat.harness, {
      model: chat.model,
      effort: chat.effort,
    });

    return command
      ? chat.handedTo(RunId.of(this.ids.generate()), this.clock.now())
      : chat;
  }

  async enqueue(chat: Chat, runId: RunId): Promise<boolean> {
    const command = this.launch.commandFor(chat.harness, {
      model: chat.model,
      effort: chat.effort,
    });

    if (!command) {
      return false;
    }

    const continuity = chat.continuity();
    const id = runId;

    const briefing = continuity.sessionId
      ? ChatBriefing.followUp(chat)
      : await this.briefed(chat);

    const queued = Run.enqueue({
      id,
      workspaceId: chat.workspaceId,
      harness: chat.harness,
      priority: CHAT_PRIORITY,
      subject: RunSubject.chat(chat.id),
      targetRunner: continuity.pinnedTo,
      spec: RunSpec.of({
        checkouts: chat.repositories.map((repository) => ({
          remote: THROUGH_SPOTLIGHT,
          path: repository.name,
        })),
        command: command.started({
          [TRACE_PARENT_VAR]: this.tracing.forChat(chat.id, id),
        }),
        briefing,
        handover: { options: [], noteLimit: 0 },
        continuity: RunSpecContract.continuityOf(continuity),
        manifest: builtInToolsFor('chat').map((each) =>
          toolManifestOf(each.declared),
        ),
        attachments: Attached.shapes(chat.allAttachments),
      }),
    });

    await this.runs.add(queued);

    return true;
  }

  private async briefed(chat: Chat): Promise<string> {
    const [team, lines] = await Promise.all([
      this.teams.find(chat.teamId),
      this.lines.ofTeam(chat.teamId),
    ]);

    return ChatBriefing.brief({
      chat,
      team: team?.name ?? null,
      lines,
    });
  }
}
