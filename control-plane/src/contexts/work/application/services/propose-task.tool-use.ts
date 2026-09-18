import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import type { BuiltInToolUse } from '@work/application/services/built-in-tools.service';
import { UnknownChatError } from '@work/domain/exceptions/unknown-chat.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { PROPOSE_TASK } from '@work/domain/services/built-in-tools';
import { proposalPlacementWithin } from '@work/domain/services/proposal-placement-within';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export class ProposeTaskToolUse implements BuiltInToolUse<ChatToolContext> {
  readonly tool = PROPOSE_TASK;

  constructor(
    private readonly chats: ChatRepository,
    private readonly lines: LineRepository,
    private readonly clock: ClockPort,
  ) {}

  async call(
    { runId, chatId, teamId }: ChatToolContext,
    inputs: ToolInputs,
  ): Promise<unknown> {
    const [chat, lines] = await Promise.all([
      this.chats.find(chatId),
      this.lines.ofTeam(teamId),
    ]);

    if (!chat) {
      throw new UnknownChatError(chatId.value);
    }

    const placement = proposalPlacementWithin(lines, {
      line: inputs.text('line') ?? '',
      station: inputs.text('station') ?? '',
    });
    const title = TaskTitle.of(inputs.text('title') ?? '');
    const description = inputs.text('description')?.trim();

    await this.chats.save(
      chat.proposed({
        runId,
        placement,
        title,
        description: description ? TaskDescription.of(description) : null,
        at: this.clock.now(),
      }),
    );

    const line = lines.find((each) => each.id.equals(placement.lineId));
    const station = line?.stationAt(placement.stationId);

    return `Proposed "${title.value}" at ${station?.name.value} on ${line?.name.value}. The person decides whether to create it, and already sees it in full, so do not repeat it to them.`;
  }
}
