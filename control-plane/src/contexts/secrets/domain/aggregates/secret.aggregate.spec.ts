import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SecretInUseError } from '@secrets/domain/exceptions/secret-in-use.error';
import { SecretMovedOnError } from '@secrets/domain/exceptions/secret-moved-on.error';
import { SecretNameFixedError } from '@secrets/domain/exceptions/secret-name-fixed.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretUnwearableError } from '@secrets/domain/exceptions/secret-unwearable.error';
import { SecretChangeDetail } from '@secrets/domain/value-objects/secret-change-detail.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { BY, definition, NOW } from '@secrets/secrets.fakes.fake-spec';
import { changesConfiguration } from '@shared-kernel/domain/events/configuration-changed';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const LATER = new Date('2026-09-24T12:00:00.000Z');
const AWS = SecretSource.awsSecretsManager({ secretId: 'linear-api-key' });

const set = (over: Parameters<typeof definition>[0] = {}) =>
  Secret.set(definition(over), {
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
    it('keeps the value it was given, and records who set it, its value version and hosts', () => {
      const secret = set();

      expect(secret.keeping?.revealed()).toBe('lin_api_1');
      expect(changes(secret)).toEqual([
        ConfigurationChange.created(
          LINEAR,
          BY,
          SecretChangeDetail.set(1, ['api.linear.app']),
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

    it('takes no value when AWS Secrets Manager holds it', () => {
      expect(() => set({ source: AWS })).toThrow(
        /cannot be set on a secret read from AWS Secrets Manager/,
      );
      expect(set({ source: AWS, value: null }).keeping).toBeNull();
    });

    it('carries its value in no event', () => {
      expect(JSON.stringify(set().pullEvents())).not.toContain('lin_api_1');
    });
  });

  describe('redefined', () => {
    it('keeps its old value while valueWoVersion stands, whatever value is sent', () => {
      const redefined = kept().redefinedAs(
        definition({ value: 'lin_api_ignored' }),
        BY,
        LATER,
      );

      expect(redefined.keeping).toBeNull();
      expect(redefined.rotatedAt).toEqual(NOW);
      expect(recorded(redefined)).toEqual([
        ['secret', 'LINEAR_API_KEY', 'updated', BY, {}],
      ]);
    });

    it('rotates to the value sent when valueWoVersion changes', () => {
      const rotated = kept().redefinedAs(
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

    it('refuses a new valueWoVersion without the value it stands for', () => {
      expect(() =>
        kept().redefinedAs(
          definition({ value: null, valueVersion: 2 }),
          BY,
          LATER,
        ),
      ).toThrow(/required when valueWoVersion changes/);
    });

    it('records where it is bound once its bindings change', () => {
      const rebound = kept().redefinedAs(
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

    it('forgets the value it kept once AWS Secrets Manager holds it', () => {
      const moved = kept().redefinedAs(
        definition({ source: AWS, value: null }),
        BY,
        LATER,
      );

      expect(moved.forgetsValue).toBe(true);
      expect(moved.keeping).toBeNull();
    });

    it('needs a value once Spotlight is to keep it again', () => {
      expect(() =>
        kept({ source: AWS, value: null }).redefinedAs(
          definition({ value: null }),
          BY,
          LATER,
        ),
      ).toThrow(/required once Spotlight keeps the secret/);
    });

    it('keeps its name for life', () => {
      expect(() =>
        kept().redefinedAs(definition({ name: 'LINEAR_TOKEN' }), BY, LATER),
      ).toThrow(SecretNameFixedError);
    });

    it('refuses a change to a version no longer current', () => {
      expect(() => kept().expecting(0)).toThrow(SecretMovedOnError);
      expect(() => kept().expecting(1)).not.toThrow();
    });
  });

  describe('deleted', () => {
    it('forgets the value Spotlight kept, and records who deleted it', () => {
      const deleted = kept().deleted(SecretUses.none(), BY);

      expect(deleted.isDeleted).toBe(true);
      expect(deleted.forgetsValue).toBe(true);
      expect(changes(deleted)).toEqual([
        ConfigurationChange.deleted(LINEAR, BY),
      ]);
    });

    it('is changed no more once deleted', () => {
      const deleted = kept().deleted(SecretUses.none(), BY);

      expect(() => deleted.deleted(SecretUses.none(), BY)).toThrow(
        /after it was deleted/,
      );
    });

    it('is not deleted while an integration still wears it', () => {
      expect(() =>
        kept().deleted(SecretUses.of(['integration core/linear']), BY),
      ).toThrow(SecretInUseError);
    });

    it('is abandoned with its workspace, whatever still names it', () => {
      const spotlight = Attribution.spotlight(WORKSPACE);
      const abandoned = kept().abandoned(spotlight);

      expect(abandoned.isDeleted).toBe(true);
      expect(abandoned.forgetsValue).toBe(true);
      expect(changes(abandoned)).toEqual([
        ConfigurationChange.deleted(LINEAR, spotlight),
      ]);
    });
  });

  describe('worn toward a host', () => {
    const value = SecretValue.of('lin_api_1');

    it('is worn in its header, after its prefix, toward a host it is bound to', () => {
      expect(
        kept().wornToward('https://api.linear.app/graphql?x=1', value),
      ).toEqual({ name: 'authorization', value: 'Bearer lin_api_1' });
    });

    it('is never worn toward a host it is not bound to', () => {
      for (const url of [
        'https://api.linear.app.evil.test/graphql',
        'https://evil.test/?api.linear.app',
        'https://linear.app/graphql',
        'https://sub.api.linear.app/graphql',
        'not a url',
      ]) {
        expect(() => kept().wornToward(url, value), url).toThrow(
          SecretNotBoundError,
        );
      }
    });

    it('is never worn over plain http, even to its host', () => {
      expect(() =>
        kept().wornToward('http://api.linear.app/graphql', value),
      ).toThrow(SecretNotBoundError);
    });

    it('is never worn where its value would break the header', () => {
      expect(() =>
        kept().wornToward(
          'https://api.linear.app/graphql',
          SecretValue.of('line\r\nx-evil: 1'),
        ),
      ).toThrow(SecretUnwearableError);
    });
  });

  describe('granted to a run', () => {
    it('is granted toward each host it is bound to, for that run alone', () => {
      const grants = kept({
        bindings: [{ host: 'api.linear.app' }, { host: 'uploads.linear.app' }],
      }).grantedTo(RunId.of('run_1'));

      expect(grants.map((each) => [each.runId.value, each.host])).toEqual([
        ['run_1', 'api.linear.app'],
        ['run_1', 'uploads.linear.app'],
      ]);
    });

    it('stands for the grant a run needs to wear it toward an address', () => {
      const grant = kept().grantToward(
        RunId.of('run_1'),
        'https://api.linear.app/graphql',
      );

      expect([grant.runId.value, grant.host]).toEqual([
        'run_1',
        'api.linear.app',
      ]);
      expect(() =>
        kept().grantToward(RunId.of('run_1'), 'https://sentry.io/'),
      ).toThrow(SecretNotBoundError);
    });

    it('is granted toward nowhere when bound to no host', () => {
      expect(() => kept({ bindings: [] }).grantedTo(RunId.of('run_1'))).toThrow(
        SecretNotBoundError,
      );
    });

    it('is worn the way it is bound toward the host a grant names', () => {
      const secret = kept({
        bindings: [
          { host: 'api.linear.app', prefix: 'Bearer ' },
          { host: 'uploads.linear.app', header: 'x-api-key' },
        ],
      });
      const [, uploads] = secret.grantedTo(RunId.of('run_1'));

      expect(uploads && secret.bindingFor(uploads)).toMatchObject({
        host: 'uploads.linear.app',
        header: 'x-api-key',
        prefix: '',
      });
    });

    it('honours no grant toward a host it is no longer bound to', () => {
      const [grant] = kept({
        bindings: [{ host: 'api.linear.app' }, { host: 'old.linear.app' }],
      }).grantedTo(RunId.of('run_1'));
      const rebound = kept({ bindings: [{ host: 'new.linear.app' }] });

      expect(() => grant && rebound.bindingFor(grant)).toThrow(
        SecretNotBoundError,
      );
    });

    it('refuses a value it cannot wear in a header', () => {
      expect(() => kept().wearable(SecretValue.of('one\ntwo'))).toThrow(
        SecretUnwearableError,
      );
      expect(kept().wearable(SecretValue.of('one')).revealed()).toBe('one');
    });
  });
});
