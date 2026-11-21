import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { ReservedSecretValueError } from '@secrets/domain/exceptions/reserved-secret-value.error';
import { SecretAwaitingValueError } from '@secrets/domain/exceptions/secret-awaiting-value.error';
import { SecretInSandboxError } from '@secrets/domain/exceptions/secret-in-sandbox.error';
import { SecretInUseError } from '@secrets/domain/exceptions/secret-in-use.error';
import { SecretKeptOutOfSandboxError } from '@secrets/domain/exceptions/secret-kept-out-of-sandbox.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretNotInjectableError } from '@secrets/domain/exceptions/secret-not-injectable.error';
import { SecretTooShortForSandboxError } from '@secrets/domain/exceptions/secret-too-short-for-sandbox.error';
import { SecretValueFromTerraformError } from '@secrets/domain/exceptions/secret-value-from-terraform.error';
import { SecretVersionConflictError } from '@secrets/domain/exceptions/secret-version-conflict.error';
import type { InjectedSecret } from '@secrets/domain/value-objects/secret-binding.vo';
import { SecretChangeDetail } from '@secrets/domain/value-objects/secret-change-detail.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import { SecretValueOrigin } from '@secrets/domain/value-objects/secret-value-origin.vo';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { ValueVersion } from '@secrets/domain/value-objects/value-version.vo';
import { BY, definition, NOW } from '@secrets/testing/secrets.fakes.fake-spec';
import { changesConfiguration } from '@shared-kernel/domain/events/configuration-changed';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const LATER = new Date('2026-09-24T12:00:00.000Z');

const set = (over: Parameters<typeof definition>[0] = {}) =>
  Secret.create(definition(over), {
    id: SecretId.of('secret_1'),
    workspaceId: WORKSPACE,
    by: BY,
    at: NOW,
  });

const rehydrated = (made: Secret, valueVersion = made.valueVersion) =>
  Secret.rehydrate({
    id: made.id,
    workspaceId: made.workspaceId,
    name: made.name,
    bindings: made.bindings,
    sandbox: made.sandbox,
    valueVersion,
    holdsValue: made.holdsValue,
    rotatedAt: made.rotatedAt,
    version: 1,
  });

const stored = (over: Parameters<typeof definition>[0] = {}) =>
  rehydrated(set(over));

const unmanaged = (over: Parameters<typeof definition>[0] = {}) =>
  rehydrated(
    set({ ...over, valueVersion: over.value === null ? null : 1 }),
    null,
  );

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

const revealedOf = (injected: InjectedSecret) => ({
  location: injected.location,
  name: injected.name,
  value: injected.revealedValue(),
  bare: injected.revealedBare(),
});

const pendingOf = (secret: Secret): string | null =>
  secret.valueWrite({
    store: (value) => value.revealed(),
    delete: () => 'delete',
    keep: () => null,
  });

describe('Secret', () => {
  describe('set', () => {
    it('stores the value it was given, and records who created it, its value version and hosts', () => {
      const secret = set();

      expect([secret.version, secret.isNew]).toEqual([0, true]);
      expect(pendingOf(secret)).toBe('lin_api_1');
      expect(changes(secret)).toEqual([
        ConfigurationChange.created(
          LINEAR,
          BY,
          SecretChangeDetail.created({
            origin: SecretValueOrigin.of({ valueVersion: 1, holdsValue: true }),
            valueVersion: 1,
            targets: ['api.linear.app'],
            sandbox: 'stand-in',
          }),
        ),
      ]);
      expect(recorded(set())).toEqual([
        [
          'secret',
          'LINEAR_API_KEY',
          'created',
          BY,
          {
            valueChange: 'stored',
            valueOrigin: 'terraform',
            valueVersion: 1,
            targets: ['api.linear.app'],
            sandbox: 'stand-in',
          },
        ],
      ]);
    });

    it('records that it awaits a value when created with none', () => {
      expect(recorded(set({ value: null, valueVersion: null }))).toEqual([
        [
          'secret',
          'LINEAR_API_KEY',
          'created',
          BY,
          {
            valueOrigin: 'awaiting',
            targets: ['api.linear.app'],
            sandbox: 'stand-in',
          },
        ],
      ]);
    });

    it('refuses a value of more than one line for a bound secret', () => {
      expect(() => set({ value: 'a\nb' })).toThrow(
        expect.objectContaining({
          constructor: InvalidSecretError,
          because: expect.stringMatching(
            /must be one line, since Spotlight sends LINEAR_API_KEY/,
          ) as unknown,
        }),
      );
    });

    it('takes a value of more than one line when bound to no host', () => {
      expect(pendingOf(set({ value: 'a\nb', bindings: [] }))).toBe('a\nb');
    });

    it('needs a value when Terraform sets valueWoVersion', () => {
      expect(() => set({ value: null })).toThrow(
        expect.objectContaining({
          constructor: InvalidSecretError,
          because: expect.stringMatching(
            /required when valueWoVersion is set/,
          ) as unknown,
        }),
      );
    });

    it('awaits a value when Terraform sends neither a value nor valueWoVersion', () => {
      const secret = set({ value: null, valueVersion: null });

      expect(pendingOf(secret)).toBeNull();
      expect(secret.valueOrigin.kind).toBe('awaiting');
    });

    it('holds the value Terraform sent with valueWoVersion', () => {
      expect(set().valueOrigin.kind).toBe('terraform');
    });

    it('refuses a value Terraform sends without valueWoVersion', () => {
      expect(() => set({ valueVersion: null })).toThrow(
        /set only together with valueWoVersion/,
      );
    });

    it('carries its value in no event', () => {
      expect(JSON.stringify(set().pullEvents())).not.toContain('lin_api_1');
    });
  });

  describe('updated', () => {
    it('stays as it was, with nothing recorded, when the definition does not change, whatever value is sent', () => {
      const existing = stored();
      const updated = existing.update(
        definition({ value: 'lin_api_ignored' }),
        BY,
        LATER,
        SecretUses.none(),
      );

      expect(updated).toBe(existing);
      expect(pendingOf(updated)).toBeNull();
      expect(updated.rotatedAt).toEqual(NOW);
      expect(recorded(updated)).toEqual([]);
    });

    it('keeps its old value while valueWoVersion does not change, when it is bound again', () => {
      const updated = stored().update(
        definition({
          value: 'lin_api_ignored',
          bindings: [{ host: 'api.linear.app', prefix: 'Token ' }],
        }),
        BY,
        LATER,
        SecretUses.none(),
      );

      expect(pendingOf(updated)).toBeNull();
      expect(updated.rotatedAt).toEqual(NOW);
      expect(recorded(updated)).toEqual([
        [
          'secret',
          'LINEAR_API_KEY',
          'updated',
          BY,
          { targets: ['api.linear.app'] },
        ],
      ]);
    });

    it('rotates to the value sent when valueWoVersion changes', () => {
      const rotated = stored().update(
        definition({ value: 'lin_api_2', valueVersion: 2 }),
        BY,
        LATER,
        SecretUses.none(),
      );

      expect(pendingOf(rotated)).toBe('lin_api_2');
      expect(rotated.valueVersion?.value).toBe(2);
      expect(rotated.rotatedAt).toEqual(LATER);
      expect(recorded(rotated)).toEqual([
        [
          'secret',
          'LINEAR_API_KEY',
          'updated',
          BY,
          { valueChange: 'stored', valueOrigin: 'terraform', valueVersion: 2 },
        ],
      ]);
    });

    it('refuses a rotated value of more than one line for a bound secret', () => {
      expect(() =>
        stored().update(
          definition({ value: 'a\nb', valueVersion: 2 }),
          BY,
          LATER,
          SecretUses.none(),
        ),
      ).toThrow(
        expect.objectContaining({
          constructor: InvalidSecretError,
          because: expect.stringMatching(
            /must be one line, since Spotlight sends LINEAR_API_KEY/,
          ) as unknown,
        }),
      );
    });

    it('refuses a value Terraform sends without valueWoVersion, and keeps the value it holds', () => {
      expect(() =>
        unmanaged().update(
          definition({ value: 'lin_api_tf', valueVersion: null }),
          BY,
          LATER,
          SecretUses.none(),
        ),
      ).toThrow(/set only together with valueWoVersion/);
    });

    it('rejects a new valueWoVersion without the value of that version', () => {
      expect(() =>
        stored().update(
          definition({ value: null, valueVersion: 2 }),
          BY,
          LATER,
          SecretUses.none(),
        ),
      ).toThrow(/required when valueWoVersion changes/);
    });

    it('keeps the value a person set when Terraform sends no valueWoVersion', () => {
      const existing = unmanaged({ value: null }).setValue(
        SecretValue.of('lin_api_person'),
        BY,
        LATER,
      );
      const kept = rehydrated(existing).update(
        definition({ value: null, valueVersion: null }),
        BY,
        LATER,
        SecretUses.none(),
      );

      expect(existing.holdsValue).toBe(true);
      expect(kept.holdsValue).toBe(true);
      expect(pendingOf(kept)).toBeNull();
      expect(recorded(kept)).toEqual([]);
    });

    it('hands its value over when Terraform stops sending valueWoVersion', () => {
      const handedOver = stored().update(
        definition({ value: null, valueVersion: null }),
        BY,
        LATER,
        SecretUses.none(),
      );

      expect(pendingOf(handedOver)).toBeNull();
      expect(handedOver.valueVersion).toBeNull();
      expect(handedOver.holdsValue).toBe(true);
      expect(handedOver.valueOrigin.kind).toBe('spotlight');
      expect(handedOver.rotatedAt).toEqual(NOW);
      expect(recorded(handedOver)).toEqual([
        [
          'secret',
          'LINEAR_API_KEY',
          'updated',
          BY,
          { valueChange: 'handed-over', valueOrigin: 'spotlight' },
        ],
      ]);
    });

    it('takes the value back when Terraform sends a valueWoVersion again', () => {
      const taken = unmanaged().update(
        definition({ value: 'lin_api_tf', valueVersion: 3 }),
        BY,
        LATER,
        SecretUses.none(),
      );

      expect(pendingOf(taken)).toBe('lin_api_tf');
      expect(taken.valueOrigin.kind).toBe('terraform');
      expect(recorded(taken)).toEqual([
        [
          'secret',
          'LINEAR_API_KEY',
          'updated',
          BY,
          { valueChange: 'stored', valueOrigin: 'terraform', valueVersion: 3 },
        ],
      ]);
    });

    it('records where it is bound once its bindings change', () => {
      const rebound = stored().update(
        definition({ bindings: [{ host: 'uploads.linear.app' }] }),
        BY,
        LATER,
        SecretUses.none(),
      );

      expect(recorded(rebound)).toEqual([
        [
          'secret',
          'LINEAR_API_KEY',
          'updated',
          BY,
          { targets: ['uploads.linear.app'] },
        ],
      ]);
    });

    it('keeps its name for life', () => {
      expect(() =>
        stored().update(
          definition({ name: 'LINEAR_TOKEN' }),
          BY,
          LATER,
          SecretUses.none(),
        ),
      ).toThrow(ImmutableFieldError);
    });

    it('rejects a change to a version no longer current', () => {
      expect(() => stored().assertVersion(0)).toThrow(
        SecretVersionConflictError,
      );
      expect(() => stored().assertVersion(1)).not.toThrow();
    });
  });

  describe('value set by a person', () => {
    const value = SecretValue.of('lin_api_person');

    it('stores the value, and records that the value moved but never the value', () => {
      const set = unmanaged({ value: null }).setValue(value, BY, LATER);

      expect(pendingOf(set)).toBe('lin_api_person');
      expect([set.valueOrigin.awaitsValue, set.rotatedAt]).toEqual([
        false,
        LATER,
      ]);
      expect(recorded(set)).toEqual([
        [
          'secret',
          'LINEAR_API_KEY',
          'updated',
          BY,
          { valueChange: 'stored', valueOrigin: 'spotlight' },
        ],
      ]);
      expect(JSON.stringify(set.pullEvents())).not.toContain('lin_api_person');
    });

    it('replaces a value a person set before', () => {
      const replaced = unmanaged().setValue(value, BY, LATER);

      expect(pendingOf(replaced)).toBe('lin_api_person');
    });

    it('is refused while Terraform sets the value', () => {
      expect(() => stored().setValue(value, BY, LATER)).toThrow(
        SecretValueFromTerraformError,
      );
    });

    it('is refused when it spans more than one line', () => {
      expect(() =>
        unmanaged().setValue(SecretValue.of('a\nb'), BY, LATER),
      ).toThrow(
        expect.objectContaining({
          constructor: InvalidSecretError,
          because: expect.stringMatching(
            /must be one line, since Spotlight sends LINEAR_API_KEY/,
          ) as unknown,
        }),
      );
    });

    it('takes a value of more than one line when bound to no host', () => {
      const taken = unmanaged({ bindings: [] }).setValue(
        SecretValue.of('a\nb'),
        BY,
        LATER,
      );

      expect(pendingOf(taken)).toBe('a\nb');
    });

    it('is refused for a secret that Spotlight keeps for itself', () => {
      expect(() =>
        unmanaged({ name: 'SPOTLIGHT_GITHUB_KEY' }).setValue(value, BY, LATER),
      ).toThrow(ReservedSecretValueError);
    });

    it('is settable only while Terraform does not set the value', () => {
      expect([
        unmanaged().valueOrigin.settable,
        stored().valueOrigin.settable,
      ]).toEqual([true, false]);
    });

    it('is refused once the secret is deleted', () => {
      const deleted = unmanaged().delete(SecretUses.none(), BY);

      expect(() => deleted.setValue(value, BY, LATER)).toThrow(
        InconsistentStateError,
      );
    });
  });

  describe('rehydrated', () => {
    it('never holds a value version without a stored value', () => {
      const awaiting = set({ value: null, valueVersion: null });

      expect(() =>
        Secret.rehydrate({
          id: awaiting.id,
          workspaceId: awaiting.workspaceId,
          name: awaiting.name,
          bindings: awaiting.bindings,
          sandbox: awaiting.sandbox,
          valueVersion: ValueVersion.of(2),
          holdsValue: false,
          rotatedAt: awaiting.rotatedAt,
          version: 1,
        }),
      ).toThrow(InconsistentStateError);
    });
  });

  describe('sandbox', () => {
    const IN_SANDBOX = SecretUses.of([
      { kind: 'harness-profile', key: 'core/full-app', inSandbox: true },
    ]);
    const NAMED = SecretUses.of([
      { kind: 'harness-profile', key: 'core/full-app', inSandbox: false },
    ]);

    it('keeps its value out of every sandbox unless it says otherwise', () => {
      expect(set().sandbox).toBe('stand-in');
      expect(() => stored().assertEntersSandbox()).toThrow(
        SecretKeptOutOfSandboxError,
      );
    });

    it('lets its value enter a sandbox once it is set to env, and records the change', () => {
      const updated = stored().update(
        definition({ sandbox: 'env' }),
        BY,
        LATER,
        SecretUses.none(),
      );

      expect(updated.sandbox).toBe('env');
      expect(() => updated.assertEntersSandbox()).not.toThrow();
      expect(recorded(updated)).not.toEqual([]);
    });

    it('is not set back to stand-in while a harness profile puts it in a sandbox', () => {
      expect(() =>
        stored({ sandbox: 'env' }).update(definition(), BY, LATER, IN_SANDBOX),
      ).toThrow(SecretInSandboxError);
    });

    it('is set back to stand-in when its uses only name it', () => {
      expect(
        stored({ sandbox: 'env' }).update(definition(), BY, LATER, NAMED)
          .sandbox,
      ).toBe('stand-in');
    });

    it('gives a sandbox a value only when the secret allows it and the value is long enough to replace', () => {
      expect(() =>
        stored().sandboxValue(SecretValue.of('ghp_long_enough')),
      ).toThrow(SecretKeptOutOfSandboxError);
      expect(() =>
        stored({ sandbox: 'env' }).sandboxValue(SecretValue.of('hunter2')),
      ).toThrow(SecretTooShortForSandboxError);
      expect(
        stored({ sandbox: 'env' })
          .sandboxValue(SecretValue.of('hunter22'))
          .revealed(),
      ).toBe('hunter22');
    });

    it('lets no value of a deleted secret enter a sandbox', () => {
      expect(() =>
        stored({ sandbox: 'env' })
          .delete(SecretUses.none(), BY)
          .assertEntersSandbox(),
      ).toThrow(/after it was deleted/);
    });
  });

  describe('value read', () => {
    it('is refused while the secret awaits a value', () => {
      expect(() =>
        rehydrated(set({ value: null, valueVersion: null })).assertHoldsValue(),
      ).toThrow(SecretAwaitingValueError);
    });

    it('is allowed once a value is stored', () => {
      expect(() => stored().assertHoldsValue()).not.toThrow();
    });
  });

  describe('deleted', () => {
    it('deletes no value when it never held one', () => {
      const deleted = rehydrated(
        set({ value: null, valueVersion: null }),
      ).delete(SecretUses.none(), BY);

      expect(pendingOf(deleted)).toBeNull();
    });

    it('deletes the value Spotlight stored, and records who deleted it', () => {
      const deleted = stored().delete(SecretUses.none(), BY);

      expect(deleted.isDeleted).toBe(true);
      expect(pendingOf(deleted)).toBe('delete');
      expect(changes(deleted)).toEqual([
        ConfigurationChange.deleted(LINEAR, BY),
      ]);
    });

    it('is changed no more once deleted', () => {
      const deleted = stored().delete(SecretUses.none(), BY);

      expect(() => deleted.delete(SecretUses.none(), BY)).toThrow(
        /after it was deleted/,
      );
    });

    it('is not deleted while an integration still uses it', () => {
      expect(() =>
        stored().delete(
          SecretUses.of([
            { kind: 'integration', key: 'core/linear', inSandbox: false },
          ]),
          BY,
        ),
      ).toThrow(SecretInUseError);
    });

    it('is deleted with its workspace, whatever still names it', () => {
      const spotlight = ChangeActor.spotlight(WORKSPACE);
      const deleted = stored().deleteWithWorkspace(WORKSPACE);

      expect(deleted.isDeleted).toBe(true);
      expect(pendingOf(deleted)).toBe('delete');
      expect(changes(deleted)).toEqual([
        ConfigurationChange.deleted(LINEAR, spotlight),
      ]);
    });

    it('is not deleted with a workspace it is not in', () => {
      expect(() =>
        stored().deleteWithWorkspace(WorkspaceId.of('ws_2')),
      ).toThrow(InconsistentStateError);
    });
  });

  describe('injected for a host', () => {
    const value = SecretValue.of('lin_api_1');

    it('is injected in its header, after its prefix, for a host it is bound to', () => {
      const injected = stored().injectedFor(
        'https://api.linear.app/graphql?x=1',
        value,
      );

      expect(revealedOf(injected)).toEqual({
        location: 'header',
        name: 'authorization',
        value: 'Bearer lin_api_1',
        bare: 'lin_api_1',
      });
      expect(JSON.stringify(injected)).not.toContain('lin_api_1');
    });

    it('is injected in its query parameter when bound to one', () => {
      expect(
        revealedOf(
          stored({
            bindings: [
              { host: 'api.linear.app', location: 'query', name: 'key' },
            ],
          }).injectedFor('https://api.linear.app/graphql', value),
        ),
      ).toEqual({
        location: 'query',
        name: 'key',
        value: 'lin_api_1',
        bare: 'lin_api_1',
      });
    });

    it.each([
      'https://api.linear.app.evil.test/graphql',
      'https://evil.test/?api.linear.app',
      'https://linear.app/graphql',
      'https://sub.api.linear.app/graphql',
      'not a url',
    ])('is never injected for a host it is not bound to: %s', (url) => {
      expect(() => stored().injectedFor(url, value)).toThrow(
        SecretNotBoundError,
      );
    });

    it('is never injected over plain http, even to its host', () => {
      expect(() =>
        stored().injectedFor('http://api.linear.app/graphql', value),
      ).toThrow(SecretNotBoundError);
    });

    it('is never injected where its value would break the header', () => {
      expect(() =>
        stored().injectedFor(
          'https://api.linear.app/graphql',
          SecretValue.of('line\r\nx-evil: 1'),
        ),
      ).toThrow(SecretNotInjectableError);
    });
  });

  describe('granted to a run', () => {
    it('is granted for each host it is bound to, for that run alone', () => {
      const grants = stored({
        bindings: [{ host: 'api.linear.app' }, { host: 'uploads.linear.app' }],
      }).grantTo(RunId.of('run_1'));

      expect(grants.map((each) => [each.runId.value, each.host.value])).toEqual(
        [
          ['run_1', 'api.linear.app'],
          ['run_1', 'uploads.linear.app'],
        ],
      );
    });

    it('makes the grant a run needs to inject it for an address', () => {
      const grant = stored().grantForUrl(
        RunId.of('run_1'),
        'https://api.linear.app/graphql',
      );

      expect([grant.runId.value, grant.host.value]).toEqual([
        'run_1',
        'api.linear.app',
      ]);
      expect(() =>
        stored().grantForUrl(RunId.of('run_1'), 'https://sentry.io/'),
      ).toThrow(SecretNotBoundError);
    });

    it('is granted for no host when bound to no host', () => {
      expect(() => stored({ bindings: [] }).grantTo(RunId.of('run_1'))).toThrow(
        SecretNotBoundError,
      );
    });

    it('is injected the way it is bound for the host a grant names', () => {
      const secret = stored({
        bindings: [
          { host: 'api.linear.app', prefix: 'Bearer ' },
          { host: 'uploads.linear.app', name: 'x-api-key' },
        ],
      });
      const [, uploads] = secret.grantTo(RunId.of('run_1'));

      expect(uploads && secret.bindingFor(uploads)).toMatchObject({
        host: { value: 'uploads.linear.app' },
        target: { location: 'header', name: 'x-api-key' },
        prefix: '',
      });
    });

    it('honours no grant for a host it is no longer bound to', () => {
      const [grant] = stored({
        bindings: [{ host: 'api.linear.app' }, { host: 'old.linear.app' }],
      }).grantTo(RunId.of('run_1'));
      const rebound = stored({ bindings: [{ host: 'new.linear.app' }] });

      expect(() => grant && rebound.bindingFor(grant)).toThrow(
        SecretNotBoundError,
      );
    });

    it('rejects a value it cannot inject in a header', () => {
      expect(() => stored().injectable(SecretValue.of('one\ntwo'))).toThrow(
        SecretNotInjectableError,
      );
      expect(stored().injectable(SecretValue.of('one')).revealed()).toBe('one');
    });
  });
});
