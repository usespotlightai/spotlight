import { RunGrantEndings } from '@secrets/application/services/run-grant-endings.service';
import { RunGrantsUnitOfWork } from '@secrets/application/services/run-grants-unit-of-work';
import { SecretInjection } from '@secrets/application/services/secret-injection.service';
import { SecretSources } from '@secrets/application/services/secret-sources.service';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import { RunGrantsEndedError } from '@secrets/domain/exceptions/run-grants-ended.error';
import { RunLeaseOverError } from '@secrets/domain/exceptions/run-lease-over.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretNotGrantedError } from '@secrets/domain/exceptions/secret-not-granted.error';
import { SecretTargetConflictError } from '@secrets/domain/exceptions/secret-target-conflict.error';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import {
  BY,
  clockAt,
  definition,
  InMemoryGrants,
  InMemorySecrets,
  InMemoryStore,
  NOW,
  readingFrom,
  WORKSPACE,
} from '@secrets/secrets.fakes.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const URL = 'https://api.linear.app/graphql';

const setUp = async () => {
  const store = new InMemoryStore();
  const secrets = new InMemorySecrets(store);
  const grants = new InMemoryGrants();
  const sources = new SecretSources(
    store,
    readingFrom({ 'sentry-token': 'sntrys_1' }),
  );

  await secrets.save(
    Secret.create(definition(), {
      id: SecretId.of('secret_linear'),
      workspaceId: WORKSPACE,
      by: BY,
      at: NOW,
    }),
  );
  await secrets.save(
    Secret.create(
      definition({
        name: 'SENTRY_TOKEN',
        source: SecretSource.awsSecretsManager({ secretId: 'sentry-token' }),
        value: null,
        bindings: [{ host: 'sentry.io', name: 'x-sentry-token' }],
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
    injection: new SecretInjection(
      secrets,
      grants,
      new RunGrantsUnitOfWork(grants),
      sources,
    ),
    secrets,
    grants,
    sources,
  };
};

const headersOf = async (
  injected: Promise<{
    applyTo(request: {
      url: globalThis.URL;
      headers: Record<string, string>;
    }): void;
  }>,
) => {
  const headers: Record<string, string> = {};
  (await injected).applyTo({
    url: new globalThis.URL('https://example.test/'),
    headers,
  });

  return headers;
};

describe('SecretInjection', () => {
  describe('for Spotlight’s own requests', () => {
    it('injects a secret for a host it is bound to', async () => {
      const { injection } = await setUp();

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

    it('rejects two secrets injected in one header for one host', async () => {
      const { injection, secrets } = await setUp();
      await secrets.save(
        Secret.create(definition({ name: 'LINEAR_OTHER' }), {
          id: SecretId.of('secret_other'),
          workspaceId: WORKSPACE,
          by: BY,
          at: NOW,
        }),
      );

      await expect(
        injection.forSpotlight({
          workspaceId: WORKSPACE.value,
          secrets: ['LINEAR_API_KEY', 'LINEAR_OTHER'],
          url: URL,
        }),
      ).rejects.toThrow(SecretTargetConflictError);
    });

    it('reads a secret that AWS Secrets Manager stores when it is injected', async () => {
      const { injection } = await setUp();

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

    it('injects nothing for a host the secret is not bound to', async () => {
      const { injection } = await setUp();

      await expect(
        injection.forSpotlight({
          workspaceId: WORKSPACE.value,
          secrets: ['LINEAR_API_KEY'],
          url: 'https://sentry.io/api/0/issues/',
        }),
      ).rejects.toThrow(SecretNotBoundError);
    });

    it('injects nothing of another workspace', async () => {
      const { injection } = await setUp();

      await expect(
        injection.forSpotlight({
          workspaceId: 'ws_2',
          secrets: ['LINEAR_API_KEY'],
          url: URL,
        }),
      ).rejects.toThrow(NoSuchSecretError);
    });

    it('injects the rotated value from the moment it is rotated', async () => {
      const { injection, secrets } = await setUp();
      const existing = (await secrets.withId(
        SecretId.of('secret_linear'),
      )) as Secret;
      const rotated = existing.update(
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

  describe('for a request that a host of the workspace sends', () => {
    it('places a stand-in where the binding injects the secret, and reads no value', async () => {
      const { injection, sources } = await setUp();
      const read = vi.spyOn(sources, 'read');

      expect(
        await headersOf(
          injection.standInsFor({
            workspaceId: WORKSPACE.value,
            secrets: ['LINEAR_API_KEY'],
            url: URL,
          }),
        ),
      ).toEqual({ authorization: 'Bearer spotlight-egress:LINEAR_API_KEY' });
      expect(
        await headersOf(
          injection.standInsFor({
            workspaceId: WORKSPACE.value,
            secrets: ['SENTRY_TOKEN'],
            url: 'https://sentry.io/api/0/issues/',
          }),
        ),
      ).toEqual({ 'x-sentry-token': 'spotlight-egress:SENTRY_TOKEN' });
      expect(read).not.toHaveBeenCalled();
    });

    it('places a stand-in in the query where the binding says', async () => {
      const { injection, secrets } = await setUp();
      await secrets.save(
        Secret.create(
          definition({
            name: 'MAPS_KEY',
            bindings: [
              { host: 'maps.example.com', location: 'query', name: 'key' },
            ],
          }),
          {
            id: SecretId.of('secret_maps'),
            workspaceId: WORKSPACE,
            by: BY,
            at: NOW,
          },
        ),
      );
      const url = new globalThis.URL('https://maps.example.com/geo?q=x');

      (
        await injection.standInsFor({
          workspaceId: WORKSPACE.value,
          secrets: ['MAPS_KEY'],
          url: url.href,
        })
      ).applyTo({ url, headers: {} });

      expect(url.search).toBe('?q=x&key=spotlight-egress%3AMAPS_KEY');
    });

    it('refuses as injection does: a missing secret, a host it is not bound to, two secrets in one header', async () => {
      const { injection, secrets } = await setUp();
      await secrets.save(
        Secret.create(definition({ name: 'LINEAR_OTHER' }), {
          id: SecretId.of('secret_other'),
          workspaceId: WORKSPACE,
          by: BY,
          at: NOW,
        }),
      );

      await expect(
        injection.standInsFor({
          workspaceId: WORKSPACE.value,
          secrets: ['NOWHERE'],
          url: URL,
        }),
      ).rejects.toThrow(NoSuchSecretError);
      await expect(
        injection.standInsFor({
          workspaceId: WORKSPACE.value,
          secrets: ['LINEAR_API_KEY'],
          url: 'https://sentry.io/api/0/issues/',
        }),
      ).rejects.toThrow(SecretNotBoundError);
      await expect(
        injection.standInsFor({
          workspaceId: WORKSPACE.value,
          secrets: ['LINEAR_API_KEY'],
          url: 'http://api.linear.app/graphql',
        }),
      ).rejects.toThrow(SecretNotBoundError);
      await expect(
        injection.standInsFor({
          workspaceId: WORKSPACE.value,
          secrets: ['LINEAR_API_KEY', 'LINEAR_OTHER'],
          url: URL,
        }),
      ).rejects.toThrow(SecretTargetConflictError);
    });

    it('places stand-ins for a run only for what the run was granted', async () => {
      const { injection } = await setUp();

      await injection.grant({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        attempt: 1,
        secrets: ['LINEAR_API_KEY'],
      });

      expect(
        await headersOf(
          injection.standInsForRun({
            workspaceId: WORKSPACE.value,
            runId: 'run_1',
            attempt: 1,
            secrets: ['LINEAR_API_KEY'],
            url: URL,
          }),
        ),
      ).toEqual({ authorization: 'Bearer spotlight-egress:LINEAR_API_KEY' });
      await expect(
        injection.standInsForRun({
          workspaceId: WORKSPACE.value,
          runId: 'run_2',
          attempt: 1,
          secrets: ['LINEAR_API_KEY'],
          url: URL,
        }),
      ).rejects.toThrow(SecretNotGrantedError);
    });
  });

  describe('for verifying what a host signed', () => {
    it('reveals the secret without binding it to any host', async () => {
      const { injection } = await setUp();

      const secret = await injection.forVerifying({
        workspaceId: WORKSPACE.value,
        secret: 'SENTRY_TOKEN',
      });

      expect(secret.revealed()).toBe('sntrys_1');
      expect(`${secret}`).toBe('[secret]');
      expect(JSON.stringify({ secret })).toBe('{"secret":"[secret]"}');
    });

    it('reveals nothing of another workspace', async () => {
      const { injection } = await setUp();

      await expect(
        injection.forVerifying({ workspaceId: 'ws_2', secret: 'SENTRY_TOKEN' }),
      ).rejects.toThrow(NoSuchSecretError);
    });
  });

  describe('for a run', () => {
    it('grants a run each secret for each host it is bound to', async () => {
      const { injection, grants } = await setUp();

      await injection.grant({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        attempt: 1,
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

    it('grants nothing it does not have', async () => {
      const { injection, grants } = await setUp();

      await expect(
        injection.grant({
          workspaceId: WORKSPACE.value,
          runId: 'run_1',
          attempt: 1,
          secrets: ['LINEAR_API_KEY', 'GITHUB_TOKEN'],
        }),
      ).rejects.toThrow(NoSuchSecretError);
      expect(grants.all).toEqual([]);
    });

    it('injects a secret granted to the run for a host it is bound to', async () => {
      const { injection } = await setUp();

      await injection.grant({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        attempt: 1,
        secrets: ['LINEAR_API_KEY'],
      });

      expect(
        await headersOf(
          injection.forRun({
            workspaceId: WORKSPACE.value,
            runId: 'run_1',
            attempt: 1,
            secrets: ['LINEAR_API_KEY'],
            url: URL,
          }),
        ),
      ).toEqual({ authorization: 'Bearer lin_api_1' });
    });

    it('injects nothing for a run it was not granted to', async () => {
      const { injection } = await setUp();

      await injection.grant({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        attempt: 1,
        secrets: ['LINEAR_API_KEY'],
      });

      await expect(
        injection.forRun({
          workspaceId: WORKSPACE.value,
          runId: 'run_2',
          attempt: 1,
          secrets: ['LINEAR_API_KEY'],
          url: URL,
        }),
      ).rejects.toThrow(SecretNotGrantedError);
    });

    it('injects nothing once the run has ended', async () => {
      const { injection, grants } = await setUp();

      for (const runId of ['run_1', 'run_2']) {
        await injection.grant({
          workspaceId: WORKSPACE.value,
          runId,
          attempt: 1,
          secrets: ['LINEAR_API_KEY'],
        });
      }
      await new RunGrantEndings(
        new RunGrantsUnitOfWork(grants),
        clockAt(),
      ).endedFor({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        attempt: 1,
      });

      expect(grants.all.map((each) => each.runId.value)).toEqual(['run_2']);

      await expect(
        injection.forRun({
          workspaceId: WORKSPACE.value,
          runId: 'run_1',
          attempt: 1,
          secrets: ['LINEAR_API_KEY'],
          url: URL,
        }),
      ).rejects.toThrow(SecretNotGrantedError);
    });

    it('grants nothing to a run whose end was received before anything was granted to it', async () => {
      const { injection, grants } = await setUp();

      await new RunGrantEndings(
        new RunGrantsUnitOfWork(grants),
        clockAt(),
      ).endedFor({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        attempt: 1,
      });

      await expect(
        injection.grant({
          workspaceId: WORKSPACE.value,
          runId: 'run_1',
          attempt: 1,
          secrets: ['LINEAR_API_KEY'],
        }),
      ).rejects.toThrow(RunGrantsEndedError);
      expect(grants.of('run_1')?.isEnded).toBe(true);
      expect(grants.all).toEqual([]);
    });

    it('grants nothing to an attempt whose lost lease was received before anything was granted to it, and grants the next attempt', async () => {
      const { injection, grants } = await setUp();
      const granting = (attempt: number) =>
        injection.grant({
          workspaceId: WORKSPACE.value,
          runId: 'run_1',
          attempt,
          secrets: ['LINEAR_API_KEY'],
        });

      await new RunGrantEndings(
        new RunGrantsUnitOfWork(grants),
        clockAt(),
      ).leaseLost({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        attempt: 1,
      });

      await expect(granting(1)).rejects.toThrow(RunLeaseOverError);
      await granting(2);

      expect(grants.all.map((each) => each.host)).toEqual(['api.linear.app']);
    });

    it('injects only what the current attempt of the run was granted', async () => {
      const { injection } = await setUp();
      const injecting = (attempt: number) =>
        injection.forRun({
          workspaceId: WORKSPACE.value,
          runId: 'run_1',
          attempt,
          secrets: ['LINEAR_API_KEY'],
          url: URL,
        });

      await injection.grant({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        attempt: 1,
        secrets: ['LINEAR_API_KEY'],
      });

      await expect(injecting(2)).rejects.toThrow(SecretNotGrantedError);

      await injection.grant({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        attempt: 2,
        secrets: ['LINEAR_API_KEY'],
      });

      expect(await headersOf(injecting(2))).toEqual({
        authorization: 'Bearer lin_api_1',
      });
      await expect(injecting(1)).rejects.toThrow(SecretNotGrantedError);
    });

    it('injects nothing for a host it was rebound away from since the grant', async () => {
      const { injection, secrets } = await setUp();

      await injection.grant({
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        attempt: 1,
        secrets: ['LINEAR_API_KEY'],
      });

      const existing = (await secrets.withId(
        SecretId.of('secret_linear'),
      )) as Secret;
      await secrets.save(
        existing.update(
          definition({ bindings: [{ host: 'uploads.linear.app' }] }),
          BY,
          NOW,
        ),
      );

      await expect(
        injection.forRun({
          workspaceId: WORKSPACE.value,
          runId: 'run_1',
          attempt: 1,
          secrets: ['LINEAR_API_KEY'],
          url: URL,
        }),
      ).rejects.toThrow(SecretNotBoundError);
    });
  });
});
