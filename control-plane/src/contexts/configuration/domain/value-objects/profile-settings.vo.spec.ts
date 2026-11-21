import { InvalidHarnessProfileError } from '@configuration/domain/exceptions/invalid-harness-profile.error';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { SandboxVariable } from '@configuration/domain/value-objects/sandbox-variable.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

const fromRaw = (native: Record<string, unknown>) =>
  ProfileSettings.fromRaw({
    permissions: { allow: [], ask: [], deny: [] },
    mcpServers: [],
    native,
    secrets: [],
    env: {},
  });

describe('ProfileSettings', () => {
  it('keeps native settings apart from the document they were written from', () => {
    const native = { 'claude-code': { env: { DEBUG: '1' } } };
    const settings = fromRaw(native);

    native['claude-code'].env.DEBUG = '0';

    expect(settings.native).toEqual({ 'claude-code': { env: { DEBUG: '1' } } });
  });

  it('rejects a change to its native settings at any depth', () => {
    const settings = fromRaw({
      'claude-code': { env: { DEBUG: '1' }, hooks: [{ run: 'lint' }] },
    });
    const harness = settings.native['claude-code'] as {
      env: Record<string, string>;
      hooks: { run: string }[];
    };

    expect(() => {
      harness.env.DEBUG = '0';
    }).toThrow(TypeError);
    expect(() => harness.hooks.push({ run: 'test' })).toThrow(TypeError);
    expect(settings.native).toEqual({
      'claude-code': { env: { DEBUG: '1' }, hooks: [{ run: 'lint' }] },
    });
  });

  describe('the secrets it names', () => {
    const naming = (secrets: string[]) =>
      ProfileSettings.fromRaw({
        permissions: { allow: [], ask: [], deny: [] },
        mcpServers: [
          {
            name: 'linear',
            command: 'linear-mcp',
            args: [],
            env: { LINEAR_API_KEY: 'secret.LINEAR_API_KEY' },
          },
        ],
        native: {},
        secrets,
        env: {},
      });

    const refusal = (secrets: string[]) => {
      try {
        naming(secrets);
      } catch (error) {
        return error instanceof InvalidHarnessProfileError
          ? { field: error.field, because: error.because }
          : error;
      }

      return null;
    };

    it('refers to each, beside the secrets its MCP servers refer to', () => {
      expect(
        naming(['STAGING_VIEWER']).secretReferences.map((each) => ({
          path: each.path.segments,
          name: each.name.value,
        })),
      ).toEqual([
        {
          path: ['mcpServers', 0, 'env', 'LINEAR_API_KEY'],
          name: 'LINEAR_API_KEY',
        },
        { path: ['secrets', 0], name: 'STAGING_VIEWER' },
      ]);
    });

    it('rejects a name that is not a secret name, and says where', () => {
      expect(refusal(['STAGING_VIEWER', 'staging viewer'])).toEqual({
        field: ['secrets', 1],
        because: expect.stringMatching(
          /^names secret staging viewer, but a secret name /,
        ) as unknown,
      });
    });

    it('rejects a secret it lists twice', () => {
      expect(refusal(['STAGING_VIEWER', 'STAGING_VIEWER'])).toEqual({
        field: ['secrets', 1],
        because: 'lists secret STAGING_VIEWER twice',
      });
    });
  });

  describe('the secrets it puts in the sandbox', () => {
    const putting = (env: Record<string, string>) =>
      ProfileSettings.fromRaw({
        permissions: { allow: [], ask: [], deny: [] },
        mcpServers: [],
        native: {},
        secrets: ['STAGING_VIEWER'],
        env,
      });

    const refusal = (env: Record<string, string>) => {
      try {
        putting(env);
      } catch (error) {
        return error instanceof InvalidHarnessProfileError
          ? { field: error.field, because: error.because }
          : error;
      }

      return null;
    };

    it('refuses the same variable twice, at the variable', () => {
      const twice = SandboxVariable.of('DATABASE_URL', 'DEV_DATABASE_URL');

      expect(() =>
        ProfileSettings.of({
          rules: [],
          mcpServers: [],
          native: {},
          secrets: [],
          sandboxEnv: [twice, twice],
        }),
      ).toThrow(
        expect.objectContaining({
          constructor: InvalidHarnessProfileError,
          field: ['env', 'DATABASE_URL'],
          because: 'sets DATABASE_URL twice',
        }),
      );
    });

    it('refers to each at its variable, and puts only those in the sandbox', () => {
      const settings = putting({
        GITHUB_APP_PRIVATE_KEY: 'DEV_GITHUB_APP_KEY',
      });

      expect(
        settings.secretReferences.map((each) => ({
          path: each.path.segments,
          name: each.name.value,
        })),
      ).toEqual([
        { path: ['secrets', 0], name: 'STAGING_VIEWER' },
        {
          path: ['env', 'GITHUB_APP_PRIVATE_KEY'],
          name: 'DEV_GITHUB_APP_KEY',
        },
      ]);
      expect(settings.env).toEqual({
        GITHUB_APP_PRIVATE_KEY: 'DEV_GITHUB_APP_KEY',
      });
      expect(settings.exposes(SecretName.of('DEV_GITHUB_APP_KEY'))).toBe(true);
      expect(settings.exposes(SecretName.of('STAGING_VIEWER'))).toBe(false);
    });

    it('rejects a variable name a shell cannot set', () => {
      expect(refusal({ 'GITHUB-KEY': 'DEV_GITHUB_APP_KEY' })).toEqual({
        field: ['env', 'GITHUB-KEY'],
        because:
          'environment variable names must use letters, digits and underscores',
      });
    });

    it('rejects a value that is not a secret name', () => {
      expect(refusal({ GITHUB_APP_PRIVATE_KEY: 'dev key' })).toEqual({
        field: ['env', 'GITHUB_APP_PRIVATE_KEY'],
        because: expect.stringMatching(
          /^names secret dev key, but a secret name /,
        ) as unknown,
      });
    });
  });
});
