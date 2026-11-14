import type { ModelCost } from '@shared-kernel/domain/value-objects/model-usage.vo';

export const INFERENCE_CALLS = Symbol('INFERENCE_CALLS');

type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';

export interface StructuredSchema<T> {
  readonly name: string;
  readonly json: unknown;
  readonly schema: { parse(input: unknown): T };
}

export interface JsonRequest<T> {
  readonly responseSchema: StructuredSchema<T>;
  readonly system: string;
  readonly prompt: string;
  readonly maxTokens: number;
  readonly reasoning?: ReasoningEffort;
}

export interface CompletionUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cost: ModelCost | null;
}

export interface StructuredCompletion<T> {
  readonly answer: T;
  readonly usage: CompletionUsage | null;
}

export interface InferenceModel {
  readonly model: string;
}

export interface InferenceCallsPort {
  endpointOf(workspaceId: string): Promise<InferenceModel | null>;

  availableTo(workspaceId: string): Promise<boolean>;

  json<T>(
    workspaceId: string,
    request: JsonRequest<T>,
  ): Promise<StructuredCompletion<T>>;
}
