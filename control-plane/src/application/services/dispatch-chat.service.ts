import {
  RunSpecContract,
  THROUGH_SPOTLIGHT,
  TRACE_PARENT_VAR,
} from '@application/contracts/run-spec.contract';
import { toolManifestOf } from '@application/mappers/tool-manifest.mapper';
import type { ClockPort } from '@application/ports/clock.port';
import type { HarnessLaunchPort } from '@application/ports/harness-launch.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { TraceParentPort } from '@application/ports/trace-parent.port';
import { Attached } from '@application/rendering/attached';
import { ChatBriefing } from '@application/rendering/chat-briefing';
import type { ChatDispatching } from '@application/services/chat-dispatch';
import type { Chat } from '@domain/aggregates/chat.aggregate';
import { Run } from '@domain/aggregates/run.aggregate';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { builtInToolsFor } from '@domain/services/built-in-tools';
import { CHAT_PRIORITY } from '@domain/services/chat-priority';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { RunSubject } from '@domain/value-objects/run-subject.vo';

export class DispatchChat implements ChatDispatching {
  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
    private readonly launch: HarnessLaunchPort,
    private readonly tracing: TraceParentPort,
    private readonly teams: TeamRepository,
    private readonly lines: LineRepository,
    private readonly clock: ClockPort,
  ) {}

  async takenUp(chat: Chat): Promise<Chat> {
    const command = this.launch.commandFor(chat.harness, {
      model: chat.model,
      effort: chat.effort,
    });

    if (!command) {
      return chat;
    }

    const continuity = chat.continuity();
    const id = RunId.of(this.ids.generate());

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
      spec: RunSpec.of(
        RunSpecContract.of({
          checkouts: chat.repositories.map((repository) => ({
            remote: THROUGH_SPOTLIGHT,
            path: repository.name,
          })),
          command: command.started({
            [TRACE_PARENT_VAR]: this.tracing.forChat(chat.id, id),
          }),
          briefing,
          handover: { options: [], noteLimit: 0 },
          continuity: continuity.told(),
          manifest: builtInToolsFor('chat').map((each) =>
            toolManifestOf(each.declared),
          ),
          attachments: Attached.shapes(chat.allAttachments),
        }),
      ),
    });

    await this.runs.add(queued);

    return chat.handedTo(queued.id, this.clock.now());
  }

  private async briefed(chat: Chat): Promise<string> {
    const [team, lines] = await Promise.all([
      this.teams.find(chat.teamId),
      this.lines.ofTeam(chat.teamId),
    ]);

    return ChatBriefing.brief({
      chat,
      team: team?.name.value ?? null,
      lines,
    });
  }
}
