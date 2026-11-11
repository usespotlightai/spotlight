import type { Env } from '@platform/config/env.schema';
import { modelEndpointOf } from '@platform/llm/model-endpoint-of';
import { describe, expect, it } from 'vitest';

const envOf = (values: Partial<Env>): Env => values as Env;

describe('the model endpoint of a feature', () => {
  it('uses the feature’s own model before the shared one', () => {
    expect(
      modelEndpointOf(
        envOf({
          LLM_BASE_URL: 'https://api.openai.com/v1',
          LLM_API_KEY: 'test-key',
          LLM_MODEL: 'shared-model',
          LLM_SUPPORTS_REASONING_EFFORT: true,
        }),
        'judge-model',
      ),
    ).toEqual({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      model: 'judge-model',
      supportsReasoningEffort: true,
    });
  });

  it('falls back to the shared model', () => {
    expect(
      modelEndpointOf(
        envOf({
          LLM_BASE_URL: 'http://localhost:11434/v1',
          LLM_MODEL: 'm',
          LLM_SUPPORTS_REASONING_EFFORT: false,
        }),
        undefined,
      ),
    ).toEqual({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: undefined,
      model: 'm',
      supportsReasoningEffort: false,
    });
  });

  it('is unset without a base URL or a model', () => {
    expect(modelEndpointOf(envOf({ LLM_MODEL: 'm' }), 'm')).toBeNull();
    expect(
      modelEndpointOf(
        envOf({ LLM_BASE_URL: 'http://localhost/v1' }),
        undefined,
      ),
    ).toBeNull();
  });
});
