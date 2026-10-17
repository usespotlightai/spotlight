import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { describe, expect, it } from 'vitest';

const written = (native: Record<string, unknown>) =>
  ProfileSettings.written({
    permissions: { allow: [], ask: [], deny: [] },
    mcpServers: [],
    native,
  });

describe('ProfileSettings', () => {
  it('keeps native settings apart from the document they were written from', () => {
    const native = { 'claude-code': { env: { DEBUG: '1' } } };
    const settings = written(native);

    native['claude-code'].env.DEBUG = '0';

    expect(settings.native).toEqual({ 'claude-code': { env: { DEBUG: '1' } } });
  });

  it('rejects a change to its native settings at any depth', () => {
    const settings = written({
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
});
