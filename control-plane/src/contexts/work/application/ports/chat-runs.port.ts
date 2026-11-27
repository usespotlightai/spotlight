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

export interface ChatRunsPort {
  /** The chat a run worked for, with the harness, model and repositories it chats with; null for a run of no chat. */
  of(runId: string): Promise<ChatRun | null>;
}
