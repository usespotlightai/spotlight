import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import type { BuiltInToolUse } from '@work/application/ports/built-in-tool-uses.port';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { Attached } from '@work/application/rendering/attached';
import type { AttachmentCopies } from '@work/application/services/attachment-copies';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatVersionConflictError } from '@work/domain/exceptions/chat-version-conflict.error';
import { InvalidToolInputError } from '@work/domain/exceptions/invalid-tool-input.error';
import { UnknownChatError } from '@work/domain/exceptions/unknown-chat.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { proposalPlacementWithin } from '@work/domain/services/proposal-placement-within';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { PROPOSE_TASK } from '@work/domain/value-objects/built-in-tools';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
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

  async call(
    { runId, chatId, teamId }: ChatToolContext,
    inputs: ToolInputs,
  ): Promise<unknown> {
    const [chat, lines] = await Promise.all([
      this.found(chatId),
      this.lines.ofTeam(teamId),
    ]);
    const named = {
      line: inputs.requiredText(this.tool, 'line').trim(),
      station: inputs.requiredText(this.tool, 'station').trim(),
    };
    const description = inputs.text('description')?.trim();
    const base = inputs.text('base')?.trim();
    const proposal = {
      runId,
      placement: proposalPlacementWithin(lines, named),
      title: TaskTitle.of(inputs.requiredText(this.tool, 'title')),
      description: nonEmpty(description)
        ? TaskDescription.of(description)
        : null,
      base: nonEmpty(base) ? Branch.of(base) : null,
      replaces: this.replacedIn(inputs),
    };
    const position = chat.proposalPositionFor(runId).value;
    const attachments = await this.copies.copy(
      chat.workspaceId,
      chat.attachmentsOf(
        inputs.texts('attach').map((each) => Attached.idIn(each)),
      ),
      (place) => `${chat.id.value}-${position}-${place}`,
    );
    const propose = async (current: Chat): Promise<Chat> => {
      const next = current.propose({
        ...proposal,
        attachments,
        at: this.clock.now(),
      });
      await this.chats.save(next);
      return next;
    };
    const proposed = await propose(chat).catch(async (error: unknown) => {
      if (error instanceof ChatVersionConflictError) {
        return propose(await this.found(chatId));
      }
      throw error;
    });

    return {
      proposed: proposal.title.value,
      number: proposed.proposals.length,
      ...(proposal.replaces.length > 0 && { replaced: proposal.replaces }),
      line: named.line,
      station: named.station,
      next: 'The person decides whether to create it, and already sees it in full, so do not repeat it to them.',
    };
  }

  private async found(chatId: ChatId): Promise<Chat> {
    const chat = await this.chats.find(chatId);

    if (!chat) {
      throw new UnknownChatError(chatId.value);
    }

    return chat;
  }

  private replacedIn(inputs: ToolInputs): number[] {
    return inputs.texts('replaces').map((each) => {
      const number = Number(each);

      if (!Number.isInteger(number) || number < 1) {
        throw new InvalidToolInputError(
          this.tool.value,
          `replaces takes proposal numbers, not "${each}"`,
        );
      }

      return number;
    });
  }
}
