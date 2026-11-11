import type { JsonObject, JsonValue } from '@shared-kernel/domain/json-value';

export const CHAT_TOOL_EXTENSIONS = Symbol('CHAT_TOOL_EXTENSIONS');

interface ChatToolTarget {
  readonly teamId: string;
  readonly lineId: string;
  readonly lineKey: string;
  readonly lineName: string;
  readonly stationId: string;
  readonly stationKey: string;
  readonly stationName: string;
}

export interface ChatToolExtensionContext {
  readonly workspaceId: string;
  readonly chatId: string;
  readonly teamId: string;
  readonly startedBy: string;
  readonly target: ChatToolTarget | null;
}

interface ChatToolInputDeclaration {
  readonly name: string;
  readonly schema: JsonObject;
  readonly description: string | null;
  readonly required: boolean;
  readonly stdin: boolean;
}

export interface ChatToolDeclaration {
  readonly tool: string;
  readonly description: string;
  readonly inputs: readonly ChatToolInputDeclaration[];
}

export interface ChatToolOffer {
  readonly offered: boolean;
  readonly briefing: string | null;
}

export interface ChatToolExtension {
  readonly declaration: ChatToolDeclaration;

  offerFor(context: ChatToolExtensionContext): Promise<ChatToolOffer>;

  call(
    context: ChatToolExtensionContext,
    inputs: Readonly<Record<string, JsonValue>>,
  ): Promise<JsonValue>;
}

export interface ChatToolExtensionsPort {
  register(extension: ChatToolExtension): void;
}
