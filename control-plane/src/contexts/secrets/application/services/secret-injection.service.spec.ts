import { RunGrants } from '@secrets/application/services/run-grants.service';
import { SecretInjection } from '@secrets/application/services/secret-injection.service';
import { SecretSources } from '@secrets/application/services/secret-sources.service';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretNotGrantedError } from '@secrets/domain/exceptions/secret-not-granted.error';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import {
  BY,
  definition,
  InMemoryGrants,
  InMemorySecrets,
  InMemoryStore,
  NOW,
  readingFrom,
  WORKSPACE,
} from '@secrets/secrets.fakes.fake-spec';
import { describe, expect, it } from 'vitest';

const URL = 'https://api.linear.app/graphql';

const holding = async () => {
  const store = new InMemoryStore();
  const secrets = new InMemorySecrets(store);
  const grants = new InMemoryGrants();
  const sources = new SecretSources(
    store,
    readingFrom({ 'sentry-token': 'sntrys_1' }),
  );

  await secrets.save(
    Secret.set(definition(), {
      id: SecretId.of('secret_linear'),
      workspaceId: WORKSPACE,
      by: BY,
      at: NOW,
    }),
  );
  await secrets.save(
    Secret.set(
      definition({
        name: 'SENTRY_TOKEN',
        source: SecretSource.awsSecretsManager({ secretId: 'sentry-token' }),
        value: null,
        bindings: [{ host: 'sentry.io', header: 'x-sentry-token' }],
      }),
      {
        id: SecretId.of('secret_sentry'),
        workspaceId: WORKSPACE,
        by: BY,
        at: NOW,
      },
    ),
  );

  return {
    injection: new SecretInjection(secrets, grants, sources),
    secrets,
    grants,
  };
};

const headersOf = async (
  worn: Promise<{ applyTo(headers: Record<string, string>): void }>,
) => {
  const headers: Record<string, string> = {};
  (await worn).applyTo(headers);

  return headers;
};

describe('SecretInjection', () => {
  describe('for Spotlight’s own requests', () => {
    it('wears a secret toward a host it is bound to', async () => {
      const { injection } = await holding();

      expect(
        await headersOf(
          injection.forSpotlight({
            workspaceId: WORKSPACE.value,
            secrets: ['LINEAR_API_KEY'],
            url: URL,
          }),
        ),
      ).toEqual({ authorization: 'Bearer lin_api_1' });
    });

    it('reads a secret AWS Secrets Manager holds when it is worn', async () => {
      const { injection } = await holding();

      expect(
        await headersOf(
          injection.forSpotlight({
            workspaceId: WORKSPACE.value,
            secrets: ['SENTRY_TOKEN'],
            url: 'https://sentry.io/api/0/issues/',
          }),
        ),
      ).toEqual({ 'x-sentry-token': 'sntrys_1' });
    });

    it('wears nothing toward a host the secret is not bound to', async () => {
      const { injection } = await holding();

      await expect(
        injection.forSpotlight({
          workspaceId: WORKSPACE.value,
          secrets: ['LINEAR_API_KEY'],
          url: 'https://sentry.io/api/0/issues/',
        }),
      ).rejects.toThrow(SecretNotBoundError);
    });

    it('wears nothing of another workspace', async () => {
      const { injection } = await holding();

      await expect(
        injection.forSpotlight({
          workspaceId: 'ws_2',
          secrets: ['LINEAR_API_KEY'],
          url: URL,
        }),
      ).rejects.toThrow(NoSuchSecretError);
    });

    it('wears the rotated value from the moment it is rotated', async () => {
      const { injection, secrets } = await holding();
      const standing = (await secrets.withId(
        SecretId.of('secret_linear'),
      )) as Secret;
      const rotated = standing.redefinedAs(
        definition({ value: 'lin_api_2', valueVersion: 2 }),
        BY,
        NOW,
      );

      await secrets.save(rotated);

      expect(
        await headersOf(
          injection.forSpotlight({
            workspaceId: WORKSPACE.value,
            secrets: ['LINEAR_API_KEY'],
            url: URL,
          }),
        ),
      ).toEqual({ authorization: 'Bearer lin_api_2' });
    });
  });

  describe('for a run', () => {
    it('grants a run each secret toward each host it is bound to', async () => {
      const { injection, grants } = await holding();

      await injection.grant({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        secrets: ['LINEAR_API_KEY', 'LINEAR_API_KEY'],
      });

      expect(
        grants.all.map((each) => [
          each.runId.value,
          each.secretId.value,
          each.host,
        ]),
      ).toEqual([['run_1', 'secret_linear', 'api.linear.app']]);
    });

    it('grants nothing it does not hold', async () => {
      const { injection, grants } = await holding();

      await expect(
        injection.grant({
          workspaceId: WORKSPACE.value,
          runId: 'run_1',
          secrets: ['LINEAR_API_KEY', 'GITHUB_TOKEN'],
        }),
      ).rejects.toThrow(NoSuchSecretError);
      expect(grants.all).toEqual([]);
    });

    it('wears a secret granted to the run toward a host it is bound to', async () => {
      const { injection } = await holding();

      await injection.grant({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        secrets: ['LINEAR_API_KEY'],
      });

      expect(
        await headersOf(
          injection.forRun({
            workspaceId: WORKSPACE.value,
            runId: 'run_1',
            secrets: ['LINEAR_API_KEY'],
            url: URL,
          }),
        ),
      ).toEqual({ authorization: 'Bearer lin_api_1' });
    });

    it('wears nothing for a run it was not granted to', async () => {
      const { injection } = await holding();

      await injection.grant({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        secrets: ['LINEAR_API_KEY'],
      });

      await expect(
        injection.forRun({
          workspaceId: WORKSPACE.value,
          runId: 'run_2',
          secrets: ['LINEAR_API_KEY'],
          url: URL,
        }),
      ).rejects.toThrow(SecretNotGrantedError);
    });

    it('wears nothing once the run has ended', async () => {
      const { injection, grants } = await holding();

      for (const runId of ['run_1', 'run_2']) {
        await injection.grant({
          workspaceId: WORKSPACE.value,
          runId,
          secrets: ['LINEAR_API_KEY'],
        });
      }
      await new RunGrants(grants).endedFor('run_1');

      expect(grants.all.map((each) => each.runId.value)).toEqual(['run_2']);

      await expect(
        injection.forRun({
          workspaceId: WORKSPACE.value,
          runId: 'run_1',
          secrets: ['LINEAR_API_KEY'],
          url: URL,
        }),
      ).rejects.toThrow(SecretNotGrantedError);
    });

    it('wears nothing toward a host it was rebound away from since the grant', async () => {
      const { injection, secrets } = await holding();

      await injection.grant({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        secrets: ['LINEAR_API_KEY'],
      });

      const standing = (await secrets.withId(
        SecretId.of('secret_linear'),
      )) as Secret;
      await secrets.save(
        standing.redefinedAs(
          definition({ bindings: [{ host: 'uploads.linear.app' }] }),
          BY,
          NOW,
        ),
      );

      await expect(
        injection.forRun({
          workspaceId: WORKSPACE.value,
          runId: 'run_1',
          secrets: ['LINEAR_API_KEY'],
          url: URL,
        }),
      ).rejects.toThrow(SecretNotBoundError);
    });
  });
});
