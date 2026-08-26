export interface RunEventView {
  readonly seq: number;
  readonly type: string;
  readonly at: string;
  readonly message?: string;
  readonly data?: string;
  readonly offset?: number;
}

export const RUN_STREAM = Symbol('RUN_STREAM');

export interface RunStreamPort {
  publish(runId: string, events: readonly RunEventView[]): void;

  subscribe(runId: string, listener: (event: RunEventView) => void): () => void;
}
