import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { BuiltInToolUse } from '@work/application/ports/built-in-tool-uses.port';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { Attached } from '@work/application/rendering/attached';
import type { AttachmentCopies } from '@work/application/services/attachment-copies';
import { ChatVersionConflictError } from '@work/domain/exceptions/chat-version-conflict.error';
import { InvalidToolInputError } from '@work/domain/exceptions/invalid-tool-input.error';
import { UnknownChatError } from '@work/domain/exceptions/unknown-chat.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { proposalPlacementWithin } from '@work/domain/services/proposal-placement-within';
import { PROPOSE_TASK } from '@work/domain/value-objects/built-in-tools';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export class ProposeTaskToolUse implements BuiltInToolUse<ChatToolContext> {
  readonly tool = PROPOSE_TASK;

  constructor(
    private readonly chats: ChatRepository,
    private readonly lines: LineMapsPort,
    private readonly copies: AttachmentCopies,
    private readonly clock: ClockPort,
  ) {}

  async call(context: ChatToolContext, inputs: ToolInputs): Promise<unknown> {
    return this.proposeOnce(context, inputs).catch((error: unknown) => {
      if (error instanceof ChatVersionConflictError) {
        return this.proposeOnce(context, inputs);
      }
      throw error;
    });
  }

  private async proposeOnce(
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

    const named = {
      line: inputs.requiredText(this.tool, 'line').trim(),
      station: inputs.requiredText(this.tool, 'station').trim(),
    };
    const placement = proposalPlacementWithin(lines, named);
    const title = TaskTitle.of(inputs.requiredText(this.tool, 'title'));
    const description = inputs.text('description')?.trim();
    const replaces = inputs.texts('replaces').map((each) => {
      const number = Number(each);

      if (!Number.isInteger(number) || number < 1) {
        throw new InvalidToolInputError(
          this.tool.value,
          `replaces takes proposal numbers, not "${each}"`,
        );
      }

      return number;
    });
    const position = chat.proposalPositionFor(runId).value;
    const attachments = await this.copies.copy(
      chat.workspaceId,
      chat.attachmentsOf(
        inputs.texts('attach').map((each) => Attached.idIn(each)),
      ),
      (place) => `${chat.id.value}-${position}-${place}`,
    );

    await this.chats.save(
      chat.propose({
        runId,
        placement,
        title,
        description: description ? TaskDescription.of(description) : null,
        attachments,
        replaces,
        at: this.clock.now(),
      }),
    );

    return {
      proposed: title.value,
      number: chat.proposals.length + 1,
      ...(replaces.length > 0 && { replaced: replaces }),
      line: named.line,
      station: named.station,
      next: 'The person decides whether to create it, and already sees it in full, so do not repeat it to them.',
    };
  }
}
