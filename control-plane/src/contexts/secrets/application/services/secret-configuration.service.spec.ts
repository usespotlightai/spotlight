import { SecretConfiguration } from '@secrets/application/services/secret-configuration.service';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import {
  BY,
  clockAt,
  definition,
  InMemorySecrets,
  WORKSPACE,
} from '@secrets/testing/secrets.fakes.fake-spec';
import { describe, expect, it } from 'vitest';

const configured = async () => {
  const secrets = new InMemorySecrets();
  const at = clockAt().now();

  await secrets.save(
    Secret.create(definition({ name: 'LINEAR_API_KEY' }), {
      id: SecretId.of('secret_1'),
      workspaceId: WORKSPACE,
      by: BY,
      at,
    }),
  );
  await secrets.save(
    Secret.create(
      definition({ name: 'SPOTLIGHT_INFERENCE_API_KEY', bindings: [] }),
      {
        id: SecretId.of('secret_2'),
        workspaceId: WORKSPACE,
        by: BY,
        at,
      },
    ),
  );

  return new SecretConfiguration(secrets);
};

describe('the secrets a workspace configures', () => {
  it('lists no secret that Spotlight keeps for itself', async () => {
    const names = (await (await configured()).in(WORKSPACE)).map(
      (each) => each.name,
    );

    expect(names).toEqual(['LINEAR_API_KEY']);
  });

  it('finds no secret that Spotlight keeps for itself by its id', async () => {
    expect(await (await configured()).withId('secret_2')).toBeNull();
  });
});
