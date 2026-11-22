import type { AssistState } from '@assist/domain/value-objects/assist-state.vo';
import type { JsonObject } from '@shared-kernel/domain/json-value';

export type { AssistFailureReason } from '@assist/domain/value-objects/assist-failure-reason.vo';
export type { AssistState } from '@assist/domain/value-objects/assist-state.vo';

export const ASSIST_SESSIONS = Symbol('ASSIST_SESSIONS');

/** What the session is for, named by the context that orders it: `<context>.<name>`, such as `insights.judge`. */
type PurposeName = string;

export interface AssistOrder {
  readonly workspaceId: string;
  readonly purpose: PurposeName;
  /** Unique per workspace and purpose. The same key reports the same session; a new key orders a new one. */
  readonly key: string;
  /** The run whose harness, model, effort, placement and working copy the session takes. */
  readonly basedOnRun: string;
  readonly briefing: string;
  readonly files: Readonly<Record<string, string>>;
  /** JSON Schema the result must match. Stored with the session and checked when the result is submitted. */
  readonly resultSchema: JsonObject;
}

export interface AssistSessionsPort {
  /** Orders the session the first time a (workspace, purpose, key) is seen; afterwards reports its state. */
  request(order: AssistOrder): Promise<AssistState>;
}
