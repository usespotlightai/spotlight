import { InferenceEndpoint } from '@inference/domain/aggregates/inference-endpoint.aggregate';
import { InferenceEndpointVersionConflictError } from '@inference/domain/exceptions/inference-endpoint-version-conflict.error';
import { BaseUrl } from '@inference/domain/value-objects/base-url.vo';
import { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import { ModelName } from '@inference/domain/value-objects/model-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const definition = (apiKeyVersion: number | null) => ({
  baseUrl: BaseUrl.of('https://openrouter.ai/api/v1'),
  model: ModelName.of('openai/gpt-5-mini'),
  supportsReasoningEffort: false,
  apiKeyVersion,
});

const created = (apiKeyVersion: number | null = null) =>
  InferenceEndpoint.create({
    id: InferenceEndpointId.of('endpoint_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    definition: definition(apiKeyVersion),
  });

describe('an inference endpoint', () => {
  it('has an API key once a key version is set', () => {
    expect(created().hasApiKey).toBe(false);
    expect(created(1).hasApiKey).toBe(true);
  });

  it('takes the new definition on update', () => {
    const updated = created().update({
      ...definition(2),
      model: ModelName.of('openai/gpt-5'),
    });

    expect(updated.definition.model.value).toBe('openai/gpt-5');
    expect(updated.hasApiKey).toBe(true);
  });

  it('refuses a write based on another version', () => {
    expect(() => created().assertVersion(3)).toThrow(
      InferenceEndpointVersionConflictError,
    );
  });

  it('refuses a change after it is deleted', () => {
    expect(() => created().delete().update(definition(null))).toThrow(
      'was changed after it was deleted',
    );
  });

  it.each(['', 'two words', 'x'.repeat(201)])(
    'refuses the model %j',
    (written) => {
      expect(() => ModelName.of(written)).toThrow('model');
    },
  );
});
