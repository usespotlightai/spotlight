export const ASSIST_SESSION_LABELS = Symbol('ASSIST_SESSION_LABELS');

/** A session to name, with the run it is based on and what that run worked on, by name; null where it had none. */
export interface LabelledSession {
  /** `<context>.<name>`, such as `insights.judge`. */
  readonly purpose: string;
  readonly key: string;
  readonly basedOn: {
    readonly runId: string;
    readonly task: string | null;
    readonly station: string | null;
  };
}

export interface SessionLabel {
  /** What the session does, in plain words, such as "Checking proposed memories". */
  readonly title: string;
  /** Whether the title opens the run the session is based on. */
  readonly opens: boolean;
}

/** Names the sessions of the purposes a context orders. */
export interface AssistSessionLabelSource {
  /** The context, as purposes name it: `insights` for `insights.judge`. */
  readonly context: string;

  labelOf(session: LabelledSession): SessionLabel | null;
}

export interface AssistSessionLabelsPort {
  register(source: AssistSessionLabelSource): void;
}
