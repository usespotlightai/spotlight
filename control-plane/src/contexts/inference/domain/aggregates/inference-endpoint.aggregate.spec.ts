import { InferenceEndpoint } from '@inference/domain/aggregates/inference-endpoint.aggregate';
import { InferenceEndpointVersionConflictError } from '@inference/domain/exceptions/inference-endpoint-version-conflict.error';
import { BaseUrl } from '@inference/domain/value-objects/base-url.vo';
import { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import { ModelName } from '@inference/domain/value-objects/model-name.vo';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const BY = ChangeActor.spotlight(WorkspaceId.of('ws_1'));

const definition = (
  apiKeyVersion: number | null,
  baseUrl = 'https://openrouter.ai/api/v1',
) => ({
  baseUrl: BaseUrl.of(baseUrl),
  model: ModelName.of('openai/gpt-5-mini'),
  apiKeyVersion,
});

const created = (apiKeyVersion: number | null = null) =>
  InferenceEndpoint.create({
    id: InferenceEndpointId.of('endpoint_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    definition: definition(apiKeyVersion),
    apiKeySent: apiKeyVersion !== null,
    by: BY,
  });

describe('an inference endpoint', () => {
  it('has an API key once a key version is set', () => {
    expect(created().hasApiKey).toBe(false);
    expect(created(1).hasApiKey).toBe(true);
  });

  it('takes the new definition on update', () => {
    const updated = created().update(
      { ...definition(2), model: ModelName.of('openai/gpt-5') },
      true,
      BY,
    );

    expect(updated.definition.model.value).toBe('openai/gpt-5');
    expect(updated.hasApiKey).toBe(true);
  });

  it('says it was created, updated, and deleted', () => {
    const deleted = created().update(definition(1), true, BY).delete(BY);

    expect(deleted.pullEvents().map((each) => each.kind)).toEqual([
      'inference-endpoint.created',
      'inference-endpoint.updated',
      'inference-endpoint.deleted',
    ]);
  });

  it('records no key in its events', () => {
    const events = JSON.stringify(created(1).pullEvents());

    expect(events).not.toContain('sk-');
  });

  it('refuses a write based on another version', () => {
    expect(() => created().assertVersion(3)).toThrow(
      InferenceEndpointVersionConflictError,
    );
  });

  it('refuses a change after it is deleted', () => {
    expect(() =>
      created().delete(BY).update(definition(null), false, BY),
    ).toThrow('was changed after it was deleted');
  });

  it.each(['', 'two words', 'x'.repeat(201)])(
    'refuses the model %j',
    (written) => {
      expect(() => ModelName.of(written)).toThrow('model');
    },
  );
});

const createdWith = (apiKeyVersion: number | null, apiKeySent: boolean) => () =>
  InferenceEndpoint.create({
    id: InferenceEndpointId.of('endpoint_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    definition: definition(apiKeyVersion),
    apiKeySent,
    by: BY,
  });

describe('the API key of a new inference endpoint', () => {
  it('stores a key sent with its version', () => {
    expect(createdWith(1, true)().apiKeyWrite).toBe('store');
  });

  it('has no key when neither a key nor a version is sent', () => {
    const keyless = createdWith(null, false)();

    expect(keyless.apiKeyWrite).toBe('keep');
    expect(keyless.hasApiKey).toBe(false);
  });

  it('refuses a key without a version', () => {
    expect(createdWith(null, true)).toThrow(
      expect.objectContaining({
        field: 'apiKeyWoVersion',
        because: 'is required with apiKeyWo',
      }),
    );
  });

  it('refuses a version without a key', () => {
    expect(createdWith(1, false)).toThrow(
      expect.objectContaining({
        field: 'apiKeyWo',
        because: 'is required when apiKeyWoVersion is set',
      }),
    );
  });
});

describe('the API key of an updated inference endpoint', () => {
  it('stores a key sent with a changed version', () => {
    const updated = created(1).update(definition(2), true, BY);

    expect(updated.apiKeyWrite).toBe('store');
    expect(updated.definition.apiKeyVersion).toBe(2);
  });

  it('keeps the stored key when the version does not change', () => {
    const updated = created(1).update(definition(1), false, BY);

    expect(updated.apiKeyWrite).toBe('keep');
    expect(updated.hasApiKey).toBe(true);
  });

  it('ignores a key sent with the same version, as Terraform sends none then', () => {
    expect(created(1).update(definition(1), true, BY).apiKeyWrite).toBe('keep');
  });

  it('removes the stored key when neither a key nor a version is sent', () => {
    const updated = created(1).update(definition(null), false, BY);

    expect(updated.apiKeyWrite).toBe('remove');
    expect(updated.hasApiKey).toBe(false);
  });

  it('adds a key to an endpoint that had none', () => {
    expect(created().update(definition(1), true, BY).apiKeyWrite).toBe('store');
  });

  it('refuses a key without a version', () => {
    expect(() => created(1).update(definition(null), true, BY)).toThrow(
      expect.objectContaining({
        field: 'apiKeyWoVersion',
        because: 'is required with apiKeyWo',
      }),
    );
  });

  it('refuses a changed version without a key', () => {
    expect(() => created(1).update(definition(2), false, BY)).toThrow(
      expect.objectContaining({
        field: 'apiKeyWo',
        because: 'is required when apiKeyWoVersion changes',
      }),
    );
  });

  it('refuses a new base URL that would get the stored key', () => {
    expect(() =>
      created(1).update(
        definition(1, 'https://attacker.example/v1'),
        false,
        BY,
      ),
    ).toThrow(
      expect.objectContaining({
        field: 'apiKeyWo',
        because:
          'is required, with a changed apiKeyWoVersion, when baseUrl changes',
      }),
    );
  });

  it('accepts a new base URL for an endpoint with no key', () => {
    expect(
      created().update(definition(null, 'http://litellm:4000/v1'), false, BY)
        .apiKeyWrite,
    ).toBe('keep');
  });

  it('accepts a new base URL with a new key', () => {
    expect(
      created(1).update(definition(2, 'https://other.example/v1'), true, BY)
        .apiKeyWrite,
    ).toBe('store');
  });
});
