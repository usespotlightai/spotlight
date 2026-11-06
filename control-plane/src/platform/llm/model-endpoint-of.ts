import type { Env } from '@platform/config/env.schema';
import type { ModelEndpoint } from '@platform/llm/chat-completions';

export const modelEndpointOf = (
  env: Env,
  model: string | undefined,
): ModelEndpoint | null => {
  const chosen = model ?? env.LLM_MODEL;

  return env.LLM_BASE_URL && chosen
    ? {
        baseUrl: env.LLM_BASE_URL,
        apiKey: env.LLM_API_KEY,
        model: chosen,
        supportsReasoningEffort: env.LLM_SUPPORTS_REASONING_EFFORT,
      }
    : null;
};
