import type { AssistFailureReason } from '@assist/domain/value-objects/assist-failure-reason.vo';
import type { JsonValue } from '@shared-kernel/domain/json-value';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

/**
 * What the context that ordered a session sees. A submitted result counts once the run has ended or reported its
 * usage; until then the session is waiting.
 */
export type AssistState =
  | { readonly status: 'waiting'; readonly since: Date }
  | {
      readonly status: 'submitted';
      readonly result: JsonValue;
      readonly usage: ModelCall | null;
      /** The harness and model the session ran, such as `claude-code/claude-sonnet-4-5`, or the harness alone. */
      readonly model: string;
    }
  | { readonly status: 'failed'; readonly reason: AssistFailureReason };

export type AssistOutcome = Exclude<AssistState['status'], 'waiting'>;
