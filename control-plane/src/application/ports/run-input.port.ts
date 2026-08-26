export interface RunInput {
  readonly data?: string;
  readonly cols?: number;
  readonly rows?: number;
  readonly stop?: boolean;
}

export const RUN_INPUT = Symbol('RUN_INPUT');

export interface RunInputPort {
  offer(runId: string, input: RunInput): void;

  take(runId: string, timeoutMs: number): Promise<RunInput[]>;
}
