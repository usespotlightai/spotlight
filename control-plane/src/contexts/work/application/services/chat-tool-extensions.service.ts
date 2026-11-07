import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type {
  ChatToolExtension,
  ChatToolExtensionContext,
  ChatToolExtensionsPort,
  ChatToolOffer,
} from '@work/application/ports/chat-tool-extensions.port';
import type {
  ChatToolContext,
  ResolvedTool,
} from '@work/application/ports/integration-tools.port';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import { UnknownChatError } from '@work/domain/exceptions/unknown-chat.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';

export interface OfferedChatTool {
  readonly declared: DeclaredTool;
  readonly briefing: string | null;
}

const declaredOf = (extension: ChatToolExtension): DeclaredTool =>
  DeclaredTool.of({
    tool: Tool.of(extension.declaration.tool),
    description: extension.declaration.description,
    inputs: extension.declaration.inputs.map((each) => ({
      name: each.name,
      schema: InputSchema.of(each.schema),
      description: each.description,
      required: each.required,
      defaulted: false,
      stdin: each.stdin,
    })),
  });

const contextOf = (chat: Chat): ChatToolExtensionContext => {
  const target = chat.targetStation;

  return {
    workspaceId: chat.workspaceId.value,
    chatId: chat.id.value,
    teamId: chat.teamId.value,
    startedBy: chat.startedBy.value,
    target: target && {
      teamId: target.teamId.value,
      lineId: target.lineId.value,
      lineKey: target.lineKey.value,
      lineName: target.lineName.value,
      stationId: target.stationId.value,
      stationKey: target.stationKey.value,
      stationName: target.stationName.value,
    },
  };
};

export class ChatToolExtensions implements ChatToolExtensionsPort {
  private readonly extensions = new Map<string, ChatToolExtension>();

  constructor(private readonly chats: ChatRepository) {}

  register(extension: ChatToolExtension): void {
    this.extensions.set(extension.declaration.tool, extension);
  }

  async offeredTo(chat: Chat): Promise<readonly OfferedChatTool[]> {
    const context = contextOf(chat);
    const offers: {
      readonly extension: ChatToolExtension;
      readonly offer: ChatToolOffer;
    }[] = [];

    for (const extension of this.extensions.values()) {
      offers.push({ extension, offer: await extension.offerFor(context) });
    }

    return offers.flatMap(({ extension, offer }) =>
      offer.offered
        ? [{ declared: declaredOf(extension), briefing: offer.briefing }]
        : [],
    );
  }

  resolve(tool: Tool, context: ChatToolContext): ResolvedTool | null {
    const extension = this.extensions.get(tool.value);

    return extension
      ? {
          declared: declaredOf(extension),
          actingAs: null,
          missing: null,
          personRule: null,
          defaultFor: () => undefined,
          call: async (inputs) =>
            extension.call(
              contextOf(await this.chatOf(context)),
              inputs.values,
            ),
        }
      : null;
  }

  private async chatOf(context: ChatToolContext): Promise<Chat> {
    const chat = await this.chats.find(context.chatId);

    if (!chat) {
      throw new UnknownChatError(context.chatId.value);
    }

    return chat;
  }
}
