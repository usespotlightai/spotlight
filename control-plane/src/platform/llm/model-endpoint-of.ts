import type { Env } from '@platform/config/env.schema';
import type { ModelEndpoint } from '@platform/llm/chat-completions';
import type { ModelPrices } from '@platform/llm/model-prices';

export const modelEndpointOf = (
  env: Env,
  model: string | undefined,
  prices?: ModelPrices,
): ModelEndpoint | null => {
  const chosen = model ?? env.LLM_MODEL;

  return env.LLM_BASE_URL && chosen
    ? {
        baseUrl: env.LLM_BASE_URL,
        apiKey: env.LLM_API_KEY,
        model: chosen,
        supportsReasoningEffort: env.LLM_SUPPORTS_REASONING_EFFORT,
        ...(prices ? { prices } : {}),
      }
    : null;
};
