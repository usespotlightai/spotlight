import { INFERENCE_KEY_SECRET } from '@inference/application/rendering/inference-problems';
import { InferenceEndpoint } from '@inference/domain/aggregates/inference-endpoint.aggregate';
import { BaseUrl } from '@inference/domain/value-objects/base-url.vo';
import { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import { ModelName } from '@inference/domain/value-objects/model-name.vo';
import { InferenceEndpoints } from '@inference/infrastructure/outbound/inference-endpoints';
import {
  InMemoryInferenceEndpoints,
  InMemoryWorkspaceSecrets,
  WORKSPACE,
} from '@inference/testing/inference.fakes.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const configured = async (apiKeyVersion: number | null = 1) => {
  const repository = new InMemoryInferenceEndpoints();
  const secrets = new InMemoryWorkspaceSecrets();
  let now = 0;

  await repository.add(
    InferenceEndpoint.create({
      id: InferenceEndpointId.of('endpoint_1'),
      workspaceId: WORKSPACE,
      definition: {
        baseUrl: BaseUrl.of('http://litellm:4000/v1'),
        model: ModelName.of('gpt-5-mini'),
        supportsReasoningEffort: true,
        apiKeyVersion,
      },
    }),
  );
  await secrets.store({
    workspaceId: WORKSPACE.value,
    name: INFERENCE_KEY_SECRET,
    value: 'sk-1',
  });

  return {
    repository,
    secrets,
    advance: (ms: number) => void (now += ms),
    endpoints: new InferenceEndpoints(
      repository,
      secrets,
      undefined,
      () => now,
      1_000,
    ),
  };
};

describe('resolving the inference endpoint of a workspace', () => {
  it('finds none for a workspace that set none', async () => {
    const { endpoints } = await configured();

    expect(await endpoints.of('ws_2')).toBeNull();
  });

  it('finds the endpoint with its key', async () => {
    const { endpoints } = await configured();

    expect(await endpoints.of(WORKSPACE.value)).toMatchObject({
      baseUrl: 'http://litellm:4000/v1',
      model: 'gpt-5-mini',
      apiKey: 'sk-1',
      supportsReasoningEffort: true,
    });
  });

  it('finds an endpoint with no key when none is set', async () => {
    const { endpoints } = await configured(null);

    expect((await endpoints.of(WORKSPACE.value))?.apiKey).toBeUndefined();
  });

  it('keeps the answer until it is forgotten', async () => {
    const { endpoints, repository } = await configured();
    const found = await endpoints.of(WORKSPACE.value);
    const stored = await repository.ofWorkspace(
      WorkspaceId.of(WORKSPACE.value),
    );

    await repository.save(stored?.delete() as InferenceEndpoint);

    expect(await endpoints.of(WORKSPACE.value)).toBe(found);

    endpoints.forget(WORKSPACE.value);

    expect(await endpoints.of(WORKSPACE.value)).toBeNull();
  });

  it('reads again after the answer is stale', async () => {
    const { endpoints, repository, advance } = await configured();
    const stored = await repository.ofWorkspace(WORKSPACE);

    await endpoints.of(WORKSPACE.value);
    await repository.save(stored?.delete() as InferenceEndpoint);
    advance(1_001);

    expect(await endpoints.of(WORKSPACE.value)).toBeNull();
  });
});
