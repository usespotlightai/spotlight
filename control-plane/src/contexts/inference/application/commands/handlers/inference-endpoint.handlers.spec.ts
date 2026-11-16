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
import { fieldErrorOf } from '@platform/http/resources/problem.exception';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { describe, expect, it } from 'vitest';

const BODY = {
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'openai/gpt-5-mini',
  apiKeyWo: 'sk-secret',
  apiKeyWoVersion: 1,
};

const KEPT = {
  baseUrl: BODY.baseUrl,
  model: BODY.model,
  apiKeyWoVersion: 1,
};

const KEYLESS = { baseUrl: BODY.baseUrl, model: BODY.model };

const problemsOf = (outcome: unknown) =>
  outcome && typeof outcome === 'object' && 'problems' in outcome
    ? (outcome.problems as readonly ConfigurationProblem[]).map((each) => {
        const { path, message } = fieldErrorOf(each);

        return { path, message };
      })
    : null;

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
        endpoints,
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

    await create(KEYLESS);

    expect(secrets.values.size).toBe(0);
  });

  it('refuses a key without a version', async () => {
    const { create, secrets } = world();

    const created = await create({ ...KEYLESS, apiKeyWo: 'sk-secret' });

    expect(problemsOf(created)).toEqual([
      { path: 'apiKeyWoVersion', message: 'is required with apiKeyWo' },
    ]);
    expect(secrets.values.size).toBe(0);
  });

  it('refuses a version without a key', async () => {
    const { create, endpoints } = world();

    const created = await create(KEPT);

    expect(problemsOf(created)).toEqual([
      {
        path: 'apiKeyWo',
        message: 'is required when apiKeyWoVersion is set',
      },
    ]);
    expect(await endpoints.ofWorkspace(WORKSPACE)).toBeNull();
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
    await update(0, { ...BODY, apiKeyWo: 'sk-new', apiKeyWoVersion: 2 });

    expect(secrets.values.get(`ws_1/${INFERENCE_KEY_SECRET}`)).toBe('sk-new');
    expect(
      (await endpoints.ofWorkspace(WORKSPACE))?.definition.apiKeyVersion,
    ).toBe(2);
  });

  it('keeps the key when the version does not change', async () => {
    const { create, update, secrets } = world();

    await create();
    await update(0, { ...KEPT, model: 'openai/gpt-5' });

    expect(secrets.values.get(`ws_1/${INFERENCE_KEY_SECRET}`)).toBe(
      'sk-secret',
    );
  });

  it('stores no key sent with an unchanged version', async () => {
    const { create, update, secrets } = world();

    await create();
    await update(0, { ...BODY, apiKeyWo: 'sk-ignored' });

    expect(secrets.values.get(`ws_1/${INFERENCE_KEY_SECRET}`)).toBe(
      'sk-secret',
    );
  });

  it('removes the key when neither a key nor a version is sent', async () => {
    const { create, update, secrets, list } = world();

    await create();

    expect(await update(0, KEYLESS)).toMatchObject({ outcome: 'updated' });
    expect(secrets.values.size).toBe(0);
    expect(JSON.stringify(await list())).toContain('"apiKeySet":false');
  });

  it('refuses a changed version without a key', async () => {
    const { create, update, secrets } = world();

    await create();

    const updated = await update(0, { ...KEPT, apiKeyWoVersion: 2 });

    expect(problemsOf(updated)).toEqual([
      {
        path: 'apiKeyWo',
        message: 'is required when apiKeyWoVersion changes',
      },
    ]);
    expect(secrets.values.get(`ws_1/${INFERENCE_KEY_SECRET}`)).toBe(
      'sk-secret',
    );
  });

  it('refuses a key without a version', async () => {
    const { create, update } = world();

    await create();

    expect(
      problemsOf(await update(0, { ...KEYLESS, apiKeyWo: 'sk-new' })),
    ).toEqual([
      { path: 'apiKeyWoVersion', message: 'is required with apiKeyWo' },
    ]);
  });

  it('asks for the key again when the base URL changes', async () => {
    const { create, update, secrets } = world();

    await create();

    const updated = await update(0, {
      ...KEPT,
      baseUrl: 'https://attacker.example/v1',
    });

    expect(problemsOf(updated)).toEqual([
      {
        path: 'apiKeyWo',
        message:
          'is required, with a changed apiKeyWoVersion, when baseUrl changes',
      },
    ]);
    expect(secrets.values.get(`ws_1/${INFERENCE_KEY_SECRET}`)).toBe(
      'sk-secret',
    );
  });

  it('accepts a new base URL with a new key', async () => {
    const { create, update } = world();

    await create();

    expect(
      await update(0, {
        ...BODY,
        baseUrl: 'https://other.example/v1',
        apiKeyWoVersion: 2,
      }),
    ).toMatchObject({ outcome: 'updated' });
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

const REFUSED_KEY = {
  ok: false,
  message: 'The endpoint refused the API key (401). Check the key.',
};

const UNANSWERED = {
  path: '',
  message:
    'The test request to the endpoint failed. Spotlight saved the change. The endpoint refused the API key (401). Check the key.',
  severity: 'warning',
};

const rendered = (applied: unknown) =>
  applied && typeof applied === 'object' && 'warnings' in applied
    ? (applied.warnings as readonly ConfigurationProblem[]).map(fieldErrorOf)
    : null;

describe('testing the inference endpoint after a write', () => {
  it('tests a created endpoint with the key it was sent, and warns of nothing when it answers', async () => {
    const { create, transport } = world();

    const created = await create();

    expect(created).toMatchObject({ outcome: 'created', warnings: [] });
    expect(transport.probed).toEqual([
      {
        workspaceId: 'ws_1',
        endpoint: {
          baseUrl: BODY.baseUrl,
          model: BODY.model,
          apiKey: 'sk-secret',
        },
        withinMs: 10_000,
      },
    ]);
  });

  it('keeps a created endpoint that fails the test, and warns why', async () => {
    const { create, transport, endpoints } = world();

    transport.answer = REFUSED_KEY;
    const created = await create();

    expect(created).toMatchObject({ outcome: 'created' });
    expect(rendered(created)).toEqual([UNANSWERED]);
    expect(await endpoints.ofWorkspace(WORKSPACE)).not.toBeNull();
  });

  it('tests an updated endpoint with the stored key when none is sent', async () => {
    const { create, update, transport } = world();

    await create();
    const updated = await update(0, { ...KEPT, model: 'openai/gpt-5' });

    expect(updated).toMatchObject({ outcome: 'updated', warnings: [] });
    expect(transport.probed[1]?.endpoint).toEqual({
      baseUrl: BODY.baseUrl,
      model: 'openai/gpt-5',
      apiKey: 'sk-secret',
    });
  });

  it('tests an endpoint whose key was removed with no key', async () => {
    const { create, update, transport } = world();

    await create();
    await update(0, KEYLESS);

    expect(transport.probed[1]?.endpoint.apiKey).toBeUndefined();
  });

  it('keeps an update that fails the test, and warns why', async () => {
    const { create, update, transport, endpoints } = world();

    await create();
    transport.answer = REFUSED_KEY;
    const updated = await update(0, { ...BODY, model: 'openai/gpt-5' });

    expect(updated).toMatchObject({ outcome: 'updated' });
    expect(rendered(updated)).toEqual([UNANSWERED]);
    expect(
      (await endpoints.ofWorkspace(WORKSPACE))?.definition.model.value,
    ).toBe('openai/gpt-5');
  });

  it('warns, and keeps the write, when the test itself cannot run', async () => {
    const { create, transport } = world();

    transport.probe = async () => {
      throw new Error('The outbound scope is closed.');
    };
    const created = await create();

    expect(created).toMatchObject({ outcome: 'created' });
    expect(rendered(created)?.[0]?.message).toContain(
      'The outbound scope is closed.',
    );
  });

  it('does not test a write it refuses', async () => {
    const { create, update, transport } = world();

    await create();
    await update(7, BODY);
    await create({ ...BODY, model: '' }, 'key-2');

    expect(transport.probed).toHaveLength(1);
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
    await test(KEYLESS);

    expect(transport.probed[transport.probed.length - 1]).toMatchObject({
      endpoint: { apiKey: 'sk-secret' },
      withinMs: 30_000,
    });
  });

  it('sends no stored key to another base URL', async () => {
    const { create, test, transport } = world();

    await create();
    await test({
      baseUrl: 'https://attacker.example/v1',
      model: BODY.model,
    });

    expect(
      transport.probed[transport.probed.length - 1]?.endpoint.apiKey,
    ).toBeUndefined();
  });

  it('uses the key that is sent', async () => {
    const { create, test, transport } = world();

    await create();
    await test({ ...BODY, apiKeyWo: 'sk-other' });

    expect(transport.probed[transport.probed.length - 1]?.endpoint.apiKey).toBe(
      'sk-other',
    );
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

    await create(KEYLESS);

    const found = await endpoints.ofWorkspace(WORKSPACE);

    expect(
      InferenceEndpointResourceMapper.resource(found as never, 'acme')
        .apiKeySet,
    ).toBe(false);
  });
});
