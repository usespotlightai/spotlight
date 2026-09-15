import type { ClockPort } from '@application/ports/clock.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { ChatToolContext } from '@application/ports/integration-tools.port';
import type { BuiltInToolUse } from '@application/services/built-in-tools.service';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import { PROPOSE_TASK } from '@domain/services/built-in-tools';
import { ProposalPlacement } from '@domain/value-objects/proposal-placement.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import type { ToolInputs } from '@domain/value-objects/tool-inputs.vo';

export class ProposeTaskToolUse implements BuiltInToolUse<ChatToolContext> {
  readonly tool = PROPOSE_TASK;

  constructor(
    private readonly chats: ChatRepository,
    private readonly events: DomainEventDispatcher,
    private readonly clock: ClockPort,
  ) {}

  async call(
    { run, chat, lines }: ChatToolContext,
    inputs: ToolInputs,
  ): Promise<unknown> {
    const placement = ProposalPlacement.within(
      lines,
      inputs.text('line') ?? '',
      inputs.text('station') ?? '',
    );
    const title = TaskTitle.of(inputs.text('title') ?? '');
    const description = inputs.text('description')?.trim();

    const proposed = chat.proposed({
      runId: run.id,
      placement,
      title,
      description: description ? TaskDescription.of(description) : null,
      at: this.clock.now(),
    });

    await this.chats.save(proposed);
    await this.events.dispatch(proposed.pullEvents());

    const line = lines.find((each) => each.id.equals(placement.lineId));
    const station = line?.stationAt(placement.stationId);

    return `Proposed "${title.value}" at ${station?.name.value} on ${line?.name.value}. The person decides whether to create it, and already sees it in full, so do not repeat it to them.`;
  }
}
