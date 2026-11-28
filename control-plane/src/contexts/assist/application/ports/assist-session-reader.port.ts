export const ASSIST_SESSION_READER = Symbol('ASSIST_SESSION_READER');

export interface NamedSessionRow {
  readonly id: string;
  readonly purpose: string;
  readonly key: string;
  readonly basedOnRun: string;
}

export interface AssistSessionReaderPort {
  /** The sessions found among these, with what names them. */
  sessionsOf(ids: readonly string[]): Promise<readonly NamedSessionRow[]>;
}
