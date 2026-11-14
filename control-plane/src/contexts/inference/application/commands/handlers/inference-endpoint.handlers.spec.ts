import { CreateInferenceEndpointHandler } from '@inference/application/commands/handlers/create-inference-endpoint.handler';
import { DeleteInferenceEndpointHandler } from '@inference/application/commands/handlers/delete-inference-endpoint.handler';
import { TestInferenceEndpointHandler } from '@inference/application/commands/handlers/test-inference-endpoint.handler';
import { UpdateInferenceEndpointHandler } from '@inference/application/commands/handlers/update-inference-endpoint.handler';
import {
  CreateInferenceEndpointCommand,
  DeleteInferenceEndpointCommand,
  TestInferenceEndpointCommand,
  UpdateInferenceEndpointCommand,
} from '@inference/application/commands/inference-endpoint.commands';
import { InferenceEndpointResourceMapper } from '@inference/application/mappers/inference-endpoint-resource.mapper';
import { ListInferenceEndpointResourcesHandler } from '@inference/application/queries/handlers/list-inference-endpoint-resources.handler';
import { ListInferenceEndpointResourcesQuery } from '@inference/application/queries/inference-endpoint.queries';
import { INFERENCE_KEY_SECRET } from '@inference/application/rendering/inference-problems';
import { InferenceEndpointDefinitions } from '@inference/infrastructure/definitions/inference-endpoint-definitions';
import {
  accessFor,
  ADMIN,
  InMemoryCreates,
  InMemoryInferenceEndpoints,
  InMemoryWorkspaceSecrets,
  RecordingTransport,
  transaction,
  WORKSPACE,
} from '@inference/testing/inference.fakes.fake-spec';
import { describe, expect, it } from 'vitest';

const BODY = {
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'openai/gpt-5-mini',
  apiKeyWo: 'sk-secret',
};

const world = (managesSecrets = true) => {
  const endpoints = new InMemoryInferenceEndpoints();
  const secrets = new InMemoryWorkspaceSecrets();
  const transport = new RecordingTransport();
  const forgotten: string[] = [];
  const resolution = { forget: (id: string) => void forgotten.push(id) };
  const access = accessFor(() => managesSecrets);
  const definitions = new InferenceEndpointDefinitions();
  let next = 0;

  return {
    endpoints,
    secrets,
    transport,
    forgotten,
    create: (definition: unknown = BODY, key = 'key-1') =>
      new CreateInferenceEndpointHandler(
        access,
        definitions,
        endpoints,
        secrets,
        transport,
        resolution,
        new InMemoryCreates(),
        { generate: () => `endpoint_${++next}` },
        transaction,
      ).execute(
        new CreateInferenceEndpointCommand(
          WORKSPACE.value,
          ADMIN,
          key,
          definition,
        ),
      ),
    update: (version: number, definition: unknown) =>
      new UpdateInferenceEndpointHandler(
        access,
        definitions,
        endpoints,
        secrets,
        transport,
        resolution,
        transaction,
      ).execute(
        new UpdateInferenceEndpointCommand(
          'endpoint_1',
          ADMIN,
          version,
          definition,
        ),
      ),
    delete: (version: number) =>
      new DeleteInferenceEndpointHandler(
        access,
        endpoints,
        secrets,
        resolution,
        transaction,
      ).execute(
        new DeleteInferenceEndpointCommand('endpoint_1', ADMIN, version),
      ),
    test: (definition: unknown) =>
      new TestInferenceEndpointHandler(
        access,
        definitions,
        secrets,
        transport,
      ).execute(
        new TestInferenceEndpointCommand(WORKSPACE.value, ADMIN, definition),
      ),
    list: () =>
      new ListInferenceEndpointResourcesHandler(access, endpoints).execute(
        new ListInferenceEndpointResourcesQuery(
          WORKSPACE.value,
          ADMIN.principal,
        ),
      ),
  };
};

describe('creating the inference endpoint', () => {
  it('stores the endpoint and the key apart', async () => {
    const { create, secrets, forgotten } = world();

    expect(await create()).toMatchObject({ outcome: 'created' });
    expect(secrets.values.get(`ws_1/${INFERENCE_KEY_SECRET}`)).toBe(
      'sk-secret',
    );
    expect(forgotten).toEqual(['ws_1']);
  });

  it('creates an endpoint with no key', async () => {
    const { create, secrets } = world();

    await create({ baseUrl: BODY.baseUrl, model: BODY.model });

    expect(secrets.values.size).toBe(0);
  });

  it.each([
    [{ ...BODY, baseUrl: 'ftp://example.com' }, 'baseUrl'],
    [{ ...BODY, model: '' }, 'model'],
    [{ ...BODY, apiKeyWo: '' }, 'apiKeyWo'],
  ])('refuses %j', async (body, field) => {
    const { create } = world();
    const created = await create(body);

    expect(created).toMatchObject({ outcome: 'invalid' });
    expect(JSON.stringify(created)).toContain(field);
  });

  it('refuses a host that the egress rules refuse', async () => {
    const { create, transport } = world();

    transport.refusal = 'The address is private.';

    expect(await create()).toMatchObject({ outcome: 'invalid' });
  });

  it('refuses a second endpoint for the workspace', async () => {
    const { create } = world();

    await create();

    expect(await create(BODY, 'key-2')).toEqual({
      outcome: 'already-exists',
      address: 'acme',
    });
  });

  it('is forbidden without the secrets scope', async () => {
    expect(await world(false).create()).toEqual({
      outcome: 'forbidden',
      act: 'secrets',
    });
  });
});

describe('updating the inference endpoint', () => {
  it('replaces the key when one is sent', async () => {
    const { create, update, secrets, endpoints } = world();

    await create();
    await update(0, { ...BODY, apiKeyWo: 'sk-new' });

    expect(secrets.values.get(`ws_1/${INFERENCE_KEY_SECRET}`)).toBe('sk-new');
    expect(
      (await endpoints.ofWorkspace(WORKSPACE))?.definition.apiKeyVersion,
    ).toBe(2);
  });

  it('keeps the key when none is sent', async () => {
    const { create, update, secrets } = world();

    await create();
    await update(0, { baseUrl: BODY.baseUrl, model: 'openai/gpt-5' });

    expect(secrets.values.get(`ws_1/${INFERENCE_KEY_SECRET}`)).toBe(
      'sk-secret',
    );
  });

  it('refuses a write based on another version', async () => {
    const { create, update } = world();

    await create();

    expect(await update(7, BODY)).toEqual({
      outcome: 'version-conflict',
      currentVersion: 0,
    });
  });
});

describe('deleting the inference endpoint', () => {
  it('deletes the key with it', async () => {
    const { create, delete: remove, secrets, endpoints } = world();

    await create();

    expect(await remove(0)).toEqual({ outcome: 'deleted' });
    expect(secrets.values.size).toBe(0);
    expect(await endpoints.ofWorkspace(WORKSPACE)).toBeNull();
  });
});

describe('testing the inference endpoint', () => {
  it('uses the stored key when none is sent', async () => {
    const { create, test, transport } = world();

    await create();
    await test({ baseUrl: BODY.baseUrl, model: BODY.model });

    expect(transport.probed[0]?.endpoint.apiKey).toBe('sk-secret');
  });

  it('uses the key that is sent', async () => {
    const { create, test, transport } = world();

    await create();
    await test({ ...BODY, apiKeyWo: 'sk-other' });

    expect(transport.probed[0]?.endpoint.apiKey).toBe('sk-other');
  });

  it('saves nothing', async () => {
    const { test, endpoints, secrets } = world();

    await test(BODY);

    expect(await endpoints.ofWorkspace(WORKSPACE)).toBeNull();
    expect(secrets.values.size).toBe(0);
  });
});

describe('what the API returns of the inference endpoint', () => {
  it('holds the key nowhere', async () => {
    const { create, list } = world();

    await create();

    const listed = JSON.stringify(await list());

    expect(listed).not.toContain('sk-secret');
    expect(listed).toContain('"apiKeySet":true');
  });

  it('says the key is not set when there is none', async () => {
    const { create, endpoints } = world();

    await create({ baseUrl: BODY.baseUrl, model: BODY.model });

    const found = await endpoints.ofWorkspace(WORKSPACE);

    expect(
      InferenceEndpointResourceMapper.resource(found as never, 'acme')
        .apiKeySet,
    ).toBe(false);
  });
});
