export interface RunJournalEntryView {
  readonly attempt: number;
  readonly seq: number;
  readonly type: string;
  readonly at: string;
  readonly message?: string;
  readonly data?: string;
}

export const RUN_STREAM = Symbol('RUN_STREAM');

export interface RunStreamPort {
  publish(runId: string, events: readonly RunJournalEntryView[]): void;

  subscribe(
    runId: string,
    listener: (event: RunJournalEntryView) => void,
  ): () => void;
}
