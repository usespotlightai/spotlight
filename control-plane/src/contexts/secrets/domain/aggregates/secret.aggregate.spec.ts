import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SecretInUseError } from '@secrets/domain/exceptions/secret-in-use.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretNotInjectableError } from '@secrets/domain/exceptions/secret-not-injectable.error';
import { SecretVersionConflictError } from '@secrets/domain/exceptions/secret-version-conflict.error';
import { SecretChangeDetail } from '@secrets/domain/value-objects/secret-change-detail.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { BY, definition, NOW } from '@secrets/secrets.fakes.fake-spec';
import { changesConfiguration } from '@shared-kernel/domain/events/configuration-changed';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const LATER = new Date('2026-09-24T12:00:00.000Z');
const AWS = SecretSource.awsSecretsManager({ secretId: 'linear-api-key' });

const set = (over: Parameters<typeof definition>[0] = {}) =>
  Secret.create(definition(over), {
    id: SecretId.of('secret_1'),
    workspaceId: WORKSPACE,
    by: BY,
    at: NOW,
  });

const kept = (over: Parameters<typeof definition>[0] = {}) => {
  const made = set(over);

  return Secret.rehydrate({
    id: made.id,
    workspaceId: made.workspaceId,
    name: made.name,
    source: made.source,
    bindings: made.bindings,
    valueVersion: made.valueVersion,
    rotatedAt: made.rotatedAt,
    version: 1,
  });
};

const LINEAR = {
  resource: 'secret' as const,
  id: 'secret_1',
  key: 'LINEAR_API_KEY',
};

const changes = (secret: Secret) =>
  secret
    .pullEvents()
    .filter(changesConfiguration)
    .map((each) => each.change);

const recorded = (secret: Secret) =>
  changes(secret).map((each) => [
    each.resource,
    each.key,
    each.action,
    each.by,
    each.recordedDetail,
  ]);

describe('Secret', () => {
  describe('set', () => {
    it('keeps the value it was given, and records who created it, its value version and hosts', () => {
      const secret = set();

      expect(secret.keeping?.revealed()).toBe('lin_api_1');
      expect(changes(secret)).toEqual([
        ConfigurationChange.created(
          LINEAR,
          BY,
          SecretChangeDetail.created(1, ['api.linear.app']),
        ),
      ]);
      expect(recorded(set())).toEqual([
        [
          'secret',
          'LINEAR_API_KEY',
          'created',
          BY,
          { valueVersion: 1, boundTo: ['api.linear.app'] },
        ],
      ]);
    });

    it('needs a value when Spotlight is to keep it', () => {
      expect(() => set({ value: null })).toThrow(
        expect.objectContaining({
          constructor: InvalidSecretError,
          because: expect.stringMatching(
            /required for a secret kept by Spotlight/,
          ),
        }),
      );
    });

    it('takes no value when AWS Secrets Manager keeps it', () => {
      expect(() => set({ source: AWS })).toThrow(
        /cannot be set on a secret read from AWS Secrets Manager/,
      );
      expect(set({ source: AWS, value: null }).keeping).toBeNull();
    });

    it('carries its value in no event', () => {
      expect(JSON.stringify(set().pullEvents())).not.toContain('lin_api_1');
    });
  });

  describe('updated', () => {
    it('keeps its old value while valueWoVersion does not change, whatever value is sent', () => {
      const updated = kept().update(
        definition({ value: 'lin_api_ignored' }),
        BY,
        LATER,
      );

      expect(updated.keeping).toBeNull();
      expect(updated.rotatedAt).toEqual(NOW);
      expect(recorded(updated)).toEqual([
        ['secret', 'LINEAR_API_KEY', 'updated', BY, {}],
      ]);
    });

    it('rotates to the value sent when valueWoVersion changes', () => {
      const rotated = kept().update(
        definition({ value: 'lin_api_2', valueVersion: 2 }),
        BY,
        LATER,
      );

      expect(rotated.keeping?.revealed()).toBe('lin_api_2');
      expect(rotated.valueVersion).toBe(2);
      expect(rotated.rotatedAt).toEqual(LATER);
      expect(recorded(rotated)).toEqual([
        ['secret', 'LINEAR_API_KEY', 'updated', BY, { valueVersion: 2 }],
      ]);
    });

    it('rejects a new valueWoVersion without the value of that version', () => {
      expect(() =>
        kept().update(definition({ value: null, valueVersion: 2 }), BY, LATER),
      ).toThrow(/required when valueWoVersion changes/);
    });

    it('records where it is bound once its bindings change', () => {
      const rebound = kept().update(
        definition({ bindings: [{ host: 'uploads.linear.app' }] }),
        BY,
        LATER,
      );

      expect(recorded(rebound)).toEqual([
        [
          'secret',
          'LINEAR_API_KEY',
          'updated',
          BY,
          { boundTo: ['uploads.linear.app'] },
        ],
      ]);
    });

    it('deletes the value it kept once AWS Secrets Manager keeps it', () => {
      const moved = kept().update(
        definition({ source: AWS, value: null }),
        BY,
        LATER,
      );

      expect(moved.deletesValue).toBe(true);
      expect(moved.keeping).toBeNull();
    });

    it('needs a value once Spotlight is to keep it again', () => {
      expect(() =>
        kept({ source: AWS, value: null }).update(
          definition({ value: null }),
          BY,
          LATER,
        ),
      ).toThrow(/required once Spotlight keeps the secret/);
    });

    it('keeps its name for life', () => {
      expect(() =>
        kept().update(definition({ name: 'LINEAR_TOKEN' }), BY, LATER),
      ).toThrow(ImmutableFieldError);
    });

    it('rejects a change to a version no longer current', () => {
      expect(() => kept().assertVersion(0)).toThrow(SecretVersionConflictError);
      expect(() => kept().assertVersion(1)).not.toThrow();
    });
  });

  describe('deleted', () => {
    it('deletes the value Spotlight kept, and records who deleted it', () => {
      const deleted = kept().delete(SecretUses.none(), BY);

      expect(deleted.isDeleted).toBe(true);
      expect(deleted.deletesValue).toBe(true);
      expect(changes(deleted)).toEqual([
        ConfigurationChange.deleted(LINEAR, BY),
      ]);
    });

    it('is changed no more once deleted', () => {
      const deleted = kept().delete(SecretUses.none(), BY);

      expect(() => deleted.delete(SecretUses.none(), BY)).toThrow(
        /after it was deleted/,
      );
    });

    it('is not deleted while an integration still uses it', () => {
      expect(() =>
        kept().delete(SecretUses.of(['integration core/linear']), BY),
      ).toThrow(SecretInUseError);
    });

    it('is deleted with its workspace, whatever still names it', () => {
      const spotlight = Attribution.spotlight(WORKSPACE);
      const deleted = kept().cascadeDelete(spotlight);

      expect(deleted.isDeleted).toBe(true);
      expect(deleted.deletesValue).toBe(true);
      expect(changes(deleted)).toEqual([
        ConfigurationChange.deleted(LINEAR, spotlight),
      ]);
    });
  });

  describe('injected for a host', () => {
    const value = SecretValue.of('lin_api_1');

    it('is injected in its header, after its prefix, for a host it is bound to', () => {
      expect(
        kept().injectedFor('https://api.linear.app/graphql?x=1', value),
      ).toEqual({
        location: 'header',
        name: 'authorization',
        value: 'Bearer lin_api_1',
        bare: 'lin_api_1',
      });
    });

    it('is injected in its query parameter when bound to one', () => {
      expect(
        kept({
          bindings: [
            { host: 'api.linear.app', location: 'query', name: 'key' },
          ],
        }).injectedFor('https://api.linear.app/graphql', value),
      ).toEqual({
        location: 'query',
        name: 'key',
        value: 'lin_api_1',
        bare: 'lin_api_1',
      });
    });

    it('is never injected for a host it is not bound to', () => {
      for (const url of [
        'https://api.linear.app.evil.test/graphql',
        'https://evil.test/?api.linear.app',
        'https://linear.app/graphql',
        'https://sub.api.linear.app/graphql',
        'not a url',
      ]) {
        expect(() => kept().injectedFor(url, value), url).toThrow(
          SecretNotBoundError,
        );
      }
    });

    it('is never injected over plain http, even to its host', () => {
      expect(() =>
        kept().injectedFor('http://api.linear.app/graphql', value),
      ).toThrow(SecretNotBoundError);
    });

    it('is never injected where its value would break the header', () => {
      expect(() =>
        kept().injectedFor(
          'https://api.linear.app/graphql',
          SecretValue.of('line\r\nx-evil: 1'),
        ),
      ).toThrow(SecretNotInjectableError);
    });
  });

  describe('granted to a run', () => {
    it('is granted for each host it is bound to, for that run alone', () => {
      const grants = kept({
        bindings: [{ host: 'api.linear.app' }, { host: 'uploads.linear.app' }],
      }).grantTo(RunId.of('run_1'));

      expect(grants.map((each) => [each.runId.value, each.host])).toEqual([
        ['run_1', 'api.linear.app'],
        ['run_1', 'uploads.linear.app'],
      ]);
    });

    it('gives the grant a run needs to inject it for an address', () => {
      const grant = kept().grantForUrl(
        RunId.of('run_1'),
        'https://api.linear.app/graphql',
      );

      expect([grant.runId.value, grant.host]).toEqual([
        'run_1',
        'api.linear.app',
      ]);
      expect(() =>
        kept().grantForUrl(RunId.of('run_1'), 'https://sentry.io/'),
      ).toThrow(SecretNotBoundError);
    });

    it('is granted for no host when bound to no host', () => {
      expect(() => kept({ bindings: [] }).grantTo(RunId.of('run_1'))).toThrow(
        SecretNotBoundError,
      );
    });

    it('is injected the way it is bound for the host a grant names', () => {
      const secret = kept({
        bindings: [
          { host: 'api.linear.app', prefix: 'Bearer ' },
          { host: 'uploads.linear.app', name: 'x-api-key' },
        ],
      });
      const [, uploads] = secret.grantTo(RunId.of('run_1'));

      expect(uploads && secret.bindingFor(uploads)).toMatchObject({
        host: 'uploads.linear.app',
        target: { location: 'header', name: 'x-api-key' },
        prefix: '',
      });
    });

    it('honours no grant for a host it is no longer bound to', () => {
      const [grant] = kept({
        bindings: [{ host: 'api.linear.app' }, { host: 'old.linear.app' }],
      }).grantTo(RunId.of('run_1'));
      const rebound = kept({ bindings: [{ host: 'new.linear.app' }] });

      expect(() => grant && rebound.bindingFor(grant)).toThrow(
        SecretNotBoundError,
      );
    });

    it('rejects a value it cannot inject in a header', () => {
      expect(() => kept().injectable(SecretValue.of('one\ntwo'))).toThrow(
        SecretNotInjectableError,
      );
      expect(kept().injectable(SecretValue.of('one')).revealed()).toBe('one');
    });
  });
});
