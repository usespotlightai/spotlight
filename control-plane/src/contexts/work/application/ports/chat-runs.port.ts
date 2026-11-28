export const CHAT_RUNS = Symbol('CHAT_RUNS');

export interface ChatRun {
  readonly runId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly chatId: string;
  readonly harness: string;
  readonly model: string | null;
  readonly repositories: readonly string[];
}

export interface ChatRunRequester {
  readonly owner: string;
  readonly kind: string;
  readonly id: string;
  readonly token: string | null;
}

export interface ChatRunsPort {
  /** The chat a run worked for, with the harness, model and repositories it chats with; null, without reading anything, for a run no chat asked for. */
  of(runId: string, requester: ChatRunRequester): Promise<ChatRun | null>;
}
