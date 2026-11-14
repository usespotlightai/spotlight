import { SecretSources } from '@secrets/application/services/secret-sources.service';
import { WorkspaceSecrets } from '@secrets/application/services/workspace-secrets.service';
import {
  clockAt,
  InMemorySecrets,
  InMemoryStore,
  readingFrom,
  WORKSPACE,
} from '@secrets/testing/secrets.fakes.fake-spec';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

const NAME = 'SPOTLIGHT_INFERENCE_API_KEY';

const storing = () => {
  const values = new InMemoryStore();
  const secrets = new InMemorySecrets(values);
  let next = 0;
  const service = new WorkspaceSecrets(
    secrets,
    new SecretSources(values, readingFrom({})),
    { generate: () => `secret_${++next}` },
    clockAt(),
  );

  return { service, secrets };
};

describe('storing a secret for a workspace', () => {
  it('stores a value that reveals as written', async () => {
    const { service } = storing();

    await service.store({
      workspaceId: WORKSPACE.value,
      name: NAME,
      value: 'sk-1',
    });

    expect(await service.reveal(WORKSPACE.value, NAME)).toBe('sk-1');
  });

  it('replaces the value and raises the value version', async () => {
    const { service, secrets } = storing();

    await service.store({
      workspaceId: WORKSPACE.value,
      name: NAME,
      value: 'sk-1',
    });
    await service.store({
      workspaceId: WORKSPACE.value,
      name: NAME,
      value: 'sk-2',
    });

    const stored = await secrets.named(WORKSPACE, SecretName.of(NAME));

    expect(await service.reveal(WORKSPACE.value, NAME)).toBe('sk-2');
    expect(stored?.valueVersion?.value).toBe(2);
  });

  it('keeps the value when none is sent', async () => {
    const { service } = storing();

    await service.store({
      workspaceId: WORKSPACE.value,
      name: NAME,
      value: 'sk-1',
    });
    await service.store({
      workspaceId: WORKSPACE.value,
      name: NAME,
      value: null,
    });

    expect(await service.reveal(WORKSPACE.value, NAME)).toBe('sk-1');
  });

  it('reveals nothing for a secret that does not exist', async () => {
    const { service } = storing();

    expect(await service.reveal(WORKSPACE.value, NAME)).toBeNull();
  });

  it('removes the secret', async () => {
    const { service } = storing();

    await service.store({
      workspaceId: WORKSPACE.value,
      name: NAME,
      value: 'sk-1',
    });
    await service.remove(WORKSPACE.value, NAME);

    expect(await service.reveal(WORKSPACE.value, NAME)).toBeNull();
  });

  it('removes nothing when the secret does not exist', async () => {
    const { service } = storing();

    await expect(
      service.remove(WORKSPACE.value, NAME),
    ).resolves.toBeUndefined();
  });
});
