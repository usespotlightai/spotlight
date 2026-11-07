import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { BuiltInToolUse } from '@work/application/ports/built-in-tool-uses.port';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import { UnknownChatError } from '@work/domain/exceptions/unknown-chat.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { SETUP_PULL_REQUEST } from '@work/domain/services/built-in-tools';
import { Branch } from '@work/domain/value-objects/branch.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { PullRequestTitle } from '@work/domain/value-objects/pull-request-title.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export class SetupPullRequestToolUse
  implements BuiltInToolUse<ChatToolContext>
{
  readonly tool = SETUP_PULL_REQUEST;

  constructor(
    private readonly chats: ChatRepository,
    private readonly pullRequests: PullRequestPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async call(
    { runId, chatId, workspaceId }: ChatToolContext,
    inputs: ToolInputs,
  ): Promise<unknown> {
    const chat = await this.found(chatId);
    const recorded = chat.setup?.pullRequest;

    if (recorded) {
      return { url: recorded.value };
    }

    const branch = Branch.of(inputs.text('branch') ?? '');
    const setup = chat.mayOpenSetupFrom(runId);
    const title = PullRequestTitle.of(inputs.requiredText(this.tool, 'title'));

    const opened = await this.pullRequests.open({
      workspaceId,
      repository: setup.repository,
      branch: branch.value,
      title: title.value,
      body: inputs.text('body') ?? '',
    });

    return this.transaction.inTransaction(async () => {
      const saved = (await this.found(chatId)).openSetup(
        runId,
        PullRequestUrl.of(opened.url),
        this.clock.now(),
      );

      await this.chats.save(saved);

      return { url: saved.setup?.pullRequest?.value ?? opened.url };
    });
  }

  private async found(chatId: ChatId): Promise<Chat> {
    const chat = await this.chats.find(chatId);

    if (!chat) {
      throw new UnknownChatError(chatId.value);
    }

    return chat;
  }
}
